import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { notifyQueueChange } from '../../../../lib/sync';
import { durationMinutes, formatDateBr, shortTime } from '../../../../lib/date';
import { useEmployees } from '../../../../hooks/useEmployees';
import { Activity, ActivityField } from '../../../../types';
import { Select } from '../../../../components/ui/Select';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import { TimePicker } from '../../../../components/ui/TimePicker';
import { DynamicFields } from '../../../../components/apontamento/DynamicFields';
import { Colors } from '../../../../constants/colors';

interface ExistingValue {
  id: string;
  field_id: string;
  value: string;
}

export default function EditApontamentoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { employees } = useEmployees(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [workDate, setWorkDate] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [existing, setExisting] = useState<ExistingValue[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('apontamentos')
        .select(`
          *,
          activity:activities(
            id, name,
            fields:activity_fields(*, options:activity_field_options(*))
          ),
          field_values:apontamento_field_values(id, field_id, value)
        `)
        .eq('id', id)
        .single();
      if (error || !data) {
        Alert.alert('Erro', error?.message ?? 'Apontamento não encontrado.');
        router.back();
        return;
      }
      const act = data.activity as Activity;
      act.fields = (act.fields ?? [])
        .slice()
        .sort((a: ActivityField, b: ActivityField) => a.sort_order - b.sort_order)
        .map((f: ActivityField) => ({
          ...f,
          options: (f.options ?? []).slice().sort((a, b) => a.sort_order - b.sort_order),
        }));
      setActivity(act);
      setWorkDate(data.work_date);
      setEmployeeId(data.employee_id);
      setStart(shortTime(data.start_time));
      setEnd(shortTime(data.end_time));
      setNotes(data.notes ?? '');
      const ex = (data.field_values ?? []) as ExistingValue[];
      setExisting(ex);
      setValues(Object.fromEntries(ex.map((v) => [v.field_id, v.value])));
      setLoading(false);
    })();
  }, [id]);

  function validate() {
    const errs: Record<string, string> = {};
    if (!employeeId) errs.employee = 'Selecione um funcionário';
    if (!start) errs.start = 'Informe o horário de início';
    if (!end) errs.end = 'Informe o horário de término';
    if (start && end && durationMinutes(start, end) === null) errs.end = 'O término deve ser depois do início';
    for (const f of activity?.fields ?? []) {
      if (f.required && !values[f.id]) errs[f.id] = 'Campo obrigatório';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate() || !activity) return;
    setSaving(true);
    try {
      const { data: updated, error } = await supabase
        .from('apontamentos')
        .update({ employee_id: employeeId, start_time: start, end_time: end, notes: notes.trim() || null })
        .eq('id', id)
        .select('id');
      if (error) throw error;
      if (!updated?.length) throw new Error('Sem permissão para editar este apontamento.');

      // atualiza campo a campo: altera o existente, cria o novo, remove o esvaziado
      for (const f of activity.fields ?? []) {
        const newValue = (values[f.id] ?? '').trim();
        const old = existing.find((v) => v.field_id === f.id);
        if (old && newValue === '') {
          const { error: e } = await supabase.from('apontamento_field_values').delete().eq('id', old.id);
          if (e) throw e;
        } else if (old && newValue !== old.value) {
          const { error: e } = await supabase.from('apontamento_field_values').update({ value: newValue }).eq('id', old.id);
          if (e) throw e;
        } else if (!old && newValue !== '') {
          const { error: e } = await supabase
            .from('apontamento_field_values')
            .insert({ apontamento_id: id, field_id: f.id, value: newValue });
          if (e) throw e;
        }
      }
      notifyQueueChange();
      router.back();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !activity) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Editar apontamento</Text>
      <Text style={styles.sub}>
        {activity.name} · {formatDateBr(workDate)}
      </Text>
      <Text style={styles.hint}>Para trocar a atividade ou a data, exclua e crie um novo apontamento.</Text>

      <Select
        label="Funcionário"
        options={[...employees]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((e) => ({ label: e.team?.name ? `${e.name} · ${e.team.name}` : e.name, value: e.id }))}
        value={employeeId}
        onChange={(v) => { setEmployeeId(v); setErrors((e) => ({ ...e, employee: '' })); }}
        error={errors.employee}
        required
      />

      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <TimePicker label="Início" value={start} onChange={setStart} error={errors.start} required />
        </View>
        <View style={{ flex: 1 }}>
          <TimePicker label="Término" value={end} onChange={setEnd} error={errors.end} required />
        </View>
      </View>

      {(activity.fields?.length ?? 0) > 0 && (
        <View style={styles.dynamic}>
          <Text style={styles.sectionLabel}>Dados da atividade</Text>
          <DynamicFields
            fields={activity.fields!}
            values={values}
            onChange={(fid, v) => { setValues((x) => ({ ...x, [fid]: v })); setErrors((e) => ({ ...e, [fid]: '' })); }}
            errors={errors}
          />
        </View>
      )}

      <Input label="Observações" value={notes} onChangeText={setNotes} placeholder="Opcional..." multiline numberOfLines={3} />

      <Button title="Salvar alterações" onPress={handleSave} loading={saving} fullWidth size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  sub: { fontSize: 14, fontWeight: '600', color: Colors.primary, marginTop: -8 },
  hint: { fontSize: 12, color: Colors.textSecondary, marginTop: -8 },
  row: { flexDirection: 'row', gap: 12 },
  dynamic: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 12, gap: 16 },
  sectionLabel: {
    fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5,
  },
});
