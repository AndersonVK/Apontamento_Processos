import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { saveOffline } from '../../../lib/offline';
import { syncPending, notifyQueueChange, isNetworkError } from '../../../lib/sync';
import { localDateIso, durationMinutes } from '../../../lib/date';
import { useAuth } from '../../../contexts/AuthContext';
import { useEmployees } from '../../../hooks/useEmployees';
import { useActivities } from '../../../hooks/useActivities';
import { Activity, ApontamentoFormData } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { TimePicker } from '../../../components/ui/TimePicker';
import { DynamicFields } from '../../../components/apontamento/DynamicFields';
import { Colors } from '../../../constants/colors';
import NetInfo from '@react-native-community/netinfo';

function todayIso() {
  return localDateIso();
}

export default function NewApontamentoScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const { employees, loading: loadingEmp } = useEmployees(false);
  const { activities, loading: loadingAct } = useActivities();

  const [form, setForm] = useState<ApontamentoFormData>({
    employee_id: '',
    activity_id: '',
    work_date: todayIso(),
    start_time: '07:00',
    end_time: '17:00',
    notes: '',
    field_values: {},
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ApontamentoFormData | string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [addAnother, setAddAnother] = useState(false);

  const selectedActivity = activities.find((a) => a.id === form.activity_id);

  function setField(key: keyof ApontamentoFormData, value: any) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  }

  function setDynamicField(fieldId: string, value: string) {
    setForm((f) => ({
      ...f,
      field_values: { ...f.field_values, [fieldId]: value },
    }));
    setErrors((e) => ({ ...e, [fieldId]: '' }));
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.employee_id) errs.employee_id = 'Selecione um funcionário';
    if (!form.activity_id) errs.activity_id = 'Selecione uma atividade';
    if (!form.start_time) errs.start_time = 'Informe o horário de início';
    if (!form.end_time) errs.end_time = 'Informe o horário de término';
    if (form.start_time && form.end_time && durationMinutes(form.start_time, form.end_time) === null) {
      errs.end_time = 'O término deve ser depois do início';
    }

    const fields = selectedActivity?.fields ?? [];
    for (const f of fields) {
      if (f.required && !form.field_values[f.id]) {
        errs[f.id] = 'Campo obrigatório';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSave() {
    if (!validate() || !profile) return;
    setSaving(true);

    const meta = {
      employee_name: employees.find((e) => e.id === form.employee_id)?.name ?? 'Funcionário',
      activity_name: selectedActivity?.name ?? 'Atividade',
      fields: (selectedActivity?.fields ?? [])
        .filter((f) => (form.field_values[f.id] ?? '') !== '')
        .map((f) => {
          const raw = form.field_values[f.id];
          const value =
            f.field_type === 'select'
              ? f.options?.find((o) => o.value === raw)?.label ?? raw
              : raw;
          return { field_id: f.id, name: f.name, value, unit: f.unit, field_type: f.field_type };
        }),
    };

    async function saveLocally() {
      await saveOffline(form, profile!.id, meta);
      notifyQueueChange();
    }

    try {
      const net = await NetInfo.fetch();

      if (net.isConnected === false) {
        await saveLocally();
      } else {
        try {
          const { data: ap, error } = await supabase
            .from('apontamentos')
            .insert({
              employee_id: form.employee_id,
              activity_id: form.activity_id,
              leader_id: profile.id,
              work_date: form.work_date,
              start_time: form.start_time,
              end_time: form.end_time,
              notes: form.notes || null,
            })
            .select('id')
            .single();
          if (error) throw error;

          const fieldEntries = Object.entries(form.field_values)
            .filter(([, v]) => v !== '')
            .map(([field_id, value]) => ({ apontamento_id: ap.id, field_id, value }));

          if (fieldEntries.length > 0) {
            const { error: fvErr } = await supabase
              .from('apontamento_field_values')
              .insert(fieldEntries);
            if (fvErr) throw fvErr;
          }
          notifyQueueChange();
        } catch (e: any) {
          // sinal ruim (conectado mas sem alcançar o servidor): guarda no aparelho
          if (isNetworkError(e)) await saveLocally();
          else throw e;
        }
      }

      if (addAnother) {
        setForm((f) => ({
          ...f,
          employee_id: '',
          notes: '',
          field_values: {},
        }));
      } else {
        router.back();
      }

      syncPending().catch(() => {});
    } catch (err: any) {
      Alert.alert('Erro', err.message ?? 'Não foi possível salvar.');
    } finally {
      setSaving(false);
    }
  }

  const myTeam = profile?.team_id ?? null;
  const employeeOptions = [...employees]
    .sort(
      (a, b) =>
        Number(b.team_id === myTeam && !!myTeam) - Number(a.team_id === myTeam && !!myTeam) ||
        a.name.localeCompare(b.name)
    )
    .map((e) => {
      const mine = !!myTeam && e.team_id === myTeam;
      const label = mine ? e.name : `${e.name} · ${e.team?.name ?? 'sem equipe'}`;
      return { label, value: e.id };
    });
  const activityOptions = activities.map((a) => ({ label: a.name, value: a.id }));

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Novo Apontamento</Text>

        <Select
          label="Funcionário"
          placeholder="Selecionar funcionário..."
          options={employeeOptions}
          value={form.employee_id}
          onChange={(v) => setField('employee_id', v)}
          error={errors.employee_id}
          required
        />

        <Select
          label="Atividade"
          placeholder="Selecionar atividade..."
          options={activityOptions}
          value={form.activity_id}
          onChange={(v) => {
            setField('activity_id', v);
            setForm((f) => ({ ...f, field_values: {} }));
          }}
          error={errors.activity_id}
          required
        />

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <TimePicker
              label="Início"
              value={form.start_time}
              onChange={(v) => setField('start_time', v)}
              error={errors.start_time}
              required
            />
          </View>
          <View style={{ flex: 1 }}>
            <TimePicker
              label="Término"
              value={form.end_time}
              onChange={(v) => setField('end_time', v)}
              error={errors.end_time}
              required
            />
          </View>
        </View>

        {selectedActivity?.fields && selectedActivity.fields.length > 0 && (
          <View style={styles.dynamicSection}>
            <Text style={styles.sectionLabel}>Dados da atividade</Text>
            <DynamicFields
              fields={selectedActivity.fields}
              values={form.field_values}
              onChange={setDynamicField}
              errors={
                Object.fromEntries(
                  Object.entries(errors).filter(([k]) =>
                    selectedActivity.fields!.some((f) => f.id === k)
                  )
                ) as Record<string, string>
              }
            />
          </View>
        )}

        <Input
          label="Observações"
          value={form.notes}
          onChangeText={(v) => setField('notes', v)}
          placeholder="Opcional..."
          multiline
          numberOfLines={3}
        />

        <View style={styles.actions}>
          <Button
            title={addAnother ? 'Salvar e adicionar outro' : 'Salvar'}
            onPress={handleSave}
            loading={saving}
            fullWidth
            size="lg"
          />
          <Button
            title={addAnother ? 'Desativar adição rápida' : 'Adição rápida (salvar e continuar)'}
            onPress={() => setAddAnother((v) => !v)}
            variant={addAnother ? 'secondary' : 'ghost'}
            fullWidth
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  screenTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 12 },
  dynamicSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
    gap: 16,
  },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  actions: { gap: 8, marginTop: 8 },
});
