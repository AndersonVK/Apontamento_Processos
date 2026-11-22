import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { useEmployees } from '../../../hooks/useEmployees';
import { useActivities } from '../../../hooks/useActivities';
import { submitApontamento, buildMeta } from '../../../lib/apontamentoService';
import { durationMinutes } from '../../../lib/date';
import { showMessage } from '../../../lib/dialog';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { TimePicker } from '../../../components/ui/TimePicker';
import { Card } from '../../../components/ui/Card';
import { DynamicFields } from '../../../components/apontamento/DynamicFields';
import { Colors } from '../../../constants/colors';

export default function BatchApontamentoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    employees: string;
    work_date: string;
    start_time?: string;
    end_time?: string;
  }>();
  const { profile } = useAuth();
  const { employees } = useEmployees(false);
  const { activities } = useActivities();

  const [remaining, setRemaining] = useState<string[]>((params.employees ?? '').split(',').filter(Boolean));
  const [activityId, setActivityId] = useState('');
  const [start, setStart] = useState(params.start_time ?? '07:00');
  const [end, setEnd] = useState(params.end_time ?? '17:00');
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const activity = activities.find((a) => a.id === activityId);
  const fields = activity?.fields ?? [];
  const nameOf = (id: string) => employees.find((e) => e.id === id)?.name ?? 'Funcionário';

  function setValue(empId: string, fieldId: string, v: string) {
    setValues((all) => ({ ...all, [empId]: { ...(all[empId] ?? {}), [fieldId]: v } }));
    setErrors((e) => ({ ...e, [`${empId}:${fieldId}`]: '' }));
  }

  function copyFirstToAll() {
    const first = values[remaining[0]] ?? {};
    setValues(Object.fromEntries(remaining.map((id) => [id, { ...first }])));
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!activityId) errs.activity = 'Selecione uma atividade';
    if (!start || !end || durationMinutes(start, end) === null) errs.time = 'O término deve ser depois do início';
    for (const id of remaining) {
      for (const f of fields) {
        if (f.required && !(values[id]?.[f.id] ?? '')) errs[`${id}:${f.id}`] = 'Obrigatório';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate() || !profile) return;
    setSaving(true);
    const failed: { id: string; message: string }[] = [];
    for (const id of remaining) {
      try {
        const fv = values[id] ?? {};
        await submitApontamento(
          {
            employee_id: id,
            activity_id: activityId,
            work_date: params.work_date,
            start_time: start,
            end_time: end,
            notes: '',
            field_values: fv,
          },
          profile.id,
          buildMeta(nameOf(id), activity, fv)
        );
      } catch (e: any) {
        failed.push({ id, message: e?.message ?? 'erro' });
      }
    }
    setSaving(false);
    if (failed.length === 0) {
      router.back();
      return;
    }
    setRemaining(failed.map((f) => f.id));
    showMessage(
      'Alguns não foram salvos',
      failed.map((f) => `${nameOf(f.id)}: ${f.message}`).join('\n') + '\n\nOs demais já foram salvos.'
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Lançar para {remaining.length} funcionário(s)</Text>
        <Text style={styles.hint}>A atividade e o horário valem para todos. Ajuste os dados de cada um abaixo.</Text>

        <Select
          label="Atividade"
          placeholder="Selecionar atividade..."
          options={activities.map((a) => ({ label: a.name, value: a.id }))}
          value={activityId}
          onChange={(v) => { setActivityId(v); setValues({}); setErrors((e) => ({ ...e, activity: '' })); }}
          error={errors.activity}
          required
        />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <TimePicker label="Início" value={start} onChange={(v) => { setStart(v); setErrors((e) => ({ ...e, time: '' })); }} required />
          </View>
          <View style={{ flex: 1 }}>
            <TimePicker label="Término" value={end} onChange={(v) => { setEnd(v); setErrors((e) => ({ ...e, time: '' })); }} error={errors.time} required />
          </View>
        </View>

        {activity && fields.length > 0 && (
          <View style={{ gap: 10 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.section}>Dados de cada funcionário</Text>
              {remaining.length > 1 && (
                <Text style={styles.link} onPress={copyFirstToAll}>Copiar o 1º para todos</Text>
              )}
            </View>
            {remaining.map((id) => (
              <Card key={id} style={{ gap: 12 }}>
                <Text style={styles.empName}>{nameOf(id)}</Text>
                <DynamicFields
                  fields={fields}
                  values={values[id] ?? {}}
                  onChange={(fid, v) => setValue(id, fid, v)}
                  errors={Object.fromEntries(fields.map((f) => [f.id, errors[`${id}:${f.id}`] ?? '']))}
                />
              </Card>
            ))}
          </View>
        )}

        {activity && fields.length === 0 && (
          <Text style={styles.hint}>Esta atividade não tem campos extras.</Text>
        )}

        <View style={styles.names}>
          {remaining.map((id) => (
            <Text key={id} style={styles.nameChip}>{nameOf(id)}</Text>
          ))}
        </View>

        <Button title={`Salvar para ${remaining.length}`} onPress={handleSave} loading={saving} fullWidth size="lg" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  hint: { fontSize: 13, color: Colors.textSecondary },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  section: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  link: { color: Colors.primaryDark, fontWeight: '700', fontSize: 13 },
  empName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  names: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  nameChip: {
    fontSize: 12, color: Colors.gray600, backgroundColor: Colors.gray100, paddingHorizontal: 8,
    paddingVertical: 4, borderRadius: 6, overflow: 'hidden',
  },
});
