import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { submitApontamento, buildMeta, lastActivityKey, lastProjectKey } from '../../../lib/apontamentoService';
import { cacheGet } from '../../../lib/cache';
import { toMin } from '../../../lib/coverage';
import { localDateIso, durationMinutes, shortTime } from '../../../lib/date';
import { useAuth } from '../../../contexts/AuthContext';
import { useEmployees } from '../../../hooks/useEmployees';
import { useActivities } from '../../../hooks/useActivities';
import { useProjects } from '../../../hooks/useProjects';
import { useDayLocked, LOCKED_MESSAGE } from '../../../hooks/useDayLocked';
import { Activity, ApontamentoFormData } from '../../../types';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { TimePicker } from '../../../components/ui/TimePicker';
import { DynamicFields } from '../../../components/apontamento/DynamicFields';
import { Colors } from '../../../constants/colors';
import { showMessage, confirmAction } from '../../../lib/dialog';

function todayIso() {
  return localDateIso();
}

export default function NewApontamentoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    employee_id?: string;
    work_date?: string;
    start_time?: string;
    end_time?: string;
    activity_id?: string;
    project_id?: string;
  }>();
  const { profile } = useAuth();
  const { employees, loading: loadingEmp } = useEmployees(false);
  const { activities, loading: loadingAct } = useActivities();
  const { projects, loading: loadingProj } = useProjects();

  const [form, setForm] = useState<ApontamentoFormData>({
    employee_id: params.employee_id ?? '',
    activity_id: params.activity_id ?? '',
    project_id: params.project_id ?? '',
    work_date: params.work_date ?? todayIso(),
    start_time: params.start_time ?? '07:00',
    end_time: params.end_time ?? '17:00',
    notes: '',
    field_values: {},
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ApontamentoFormData | string, string>>>({});
  const [saving, setSaving] = useState(false);
  const [addAnother, setAddAnother] = useState(false);

  useEffect(() => {
    if (form.activity_id || !profile) return;
    cacheGet<string>(lastActivityKey(profile.id)).then((id) => {
      if (id) setForm((f) => (f.activity_id ? f : { ...f, activity_id: id }));
    });
  }, [profile?.id]);

  // projeto: reaproveita o último usado quando a tela abre sem projeto definido
  useEffect(() => {
    if (form.project_id || !profile) return;
    cacheGet<string>(lastProjectKey(profile.id)).then((id) => {
      if (id) setForm((f) => (f.project_id ? f : { ...f, project_id: id }));
    });
  }, [profile?.id]);

  // só vale o projeto se ainda existe e está ativo (pode ter sido desativado)
  useEffect(() => {
    if (!loadingProj && form.project_id && !projects.some((p) => p.id === form.project_id)) {
      setForm((f) => ({ ...f, project_id: '' }));
    }
  }, [loadingProj, projects]);

  const selectedActivity = activities.find((a) => a.id === form.activity_id);
  const locked = useDayLocked(form.work_date);

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
    if (!form.project_id) errs.project_id = 'Selecione um projeto';
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

  /** Avisa de sobreposição de horário e de falta registrada. true = pode salvar. */
  async function confirmConflicts(): Promise<boolean> {
    try {
      const [ap, idle, abs] = await Promise.all([
        supabase.from('apontamentos').select('start_time, end_time').eq('employee_id', form.employee_id).eq('work_date', form.work_date),
        supabase.from('idle_blocks').select('start_time, end_time').eq('employee_id', form.employee_id).eq('work_date', form.work_date),
        supabase.from('absences').select('reason_type').eq('employee_id', form.employee_id).eq('work_date', form.work_date),
      ]);
      const s0 = toMin(form.start_time);
      const e0 = toMin(form.end_time);
      const existing = [...((ap.data as any[]) ?? []), ...((idle.error ? [] : (idle.data as any[])) ?? [])];
      const clash = existing.find((x) => {
        const xs = toMin(x.start_time);
        const xe = toMin(x.end_time);
        return xs !== null && xe !== null && s0 !== null && e0 !== null && xs < e0 && xe > s0;
      });
      if (clash) {
        const ok = await confirmAction(
          'Horário sobreposto',
          `Este funcionário já tem ${shortTime(clash.start_time)}–${shortTime(clash.end_time)} apontado neste dia. Salvar mesmo assim?`,
          'Salvar mesmo assim'
        );
        if (!ok) return false;
      }
      if (!abs.error && ((abs.data as any[]) ?? []).length > 0) {
        const ok = await confirmAction(
          'Funcionário com falta',
          'Este funcionário está com falta registrada neste dia. Lançar mesmo assim?',
          'Lançar mesmo assim'
        );
        if (!ok) return false;
      }
    } catch {
      // sem internet: segue sem a checagem
    }
    return true;
  }

  async function handleSave() {
    if (!validate() || !profile) return;
    setSaving(true);
    try {
      if (!(await confirmConflicts())) return;
      const meta = buildMeta(
        employees.find((e) => e.id === form.employee_id)?.name ?? 'Funcionário',
        selectedActivity,
        form.field_values,
        projects.find((p) => p.id === form.project_id)?.name ?? 'Projeto'
      );
      await submitApontamento(form, profile.id, meta);

      if (addAnother) {
        setForm((f) => ({ ...f, employee_id: '', notes: '', field_values: {} }));
      } else {
        router.back();
      }
    } catch (err: any) {
      showMessage('Erro', err.message ?? 'Não foi possível salvar.');
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
          label="Projeto"
          placeholder={projects.length === 0 && !loadingProj ? 'Nenhum projeto cadastrado' : 'Selecionar projeto...'}
          options={projects.map((p) => ({ label: p.name, value: p.id }))}
          value={form.project_id}
          onChange={(v) => setField('project_id', v)}
          error={errors.project_id}
          required
        />
        {projects.length === 0 && !loadingProj && (
          <Text style={styles.noProjects}>
            Cadastre um projeto em Configurações → Projetos (ou peça a um gerente) para poder apontar.
          </Text>
        )}

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
          {locked && <Text style={styles.noProjects}>{LOCKED_MESSAGE}</Text>}
          <Button
            title={addAnother ? 'Salvar e adicionar outro' : 'Salvar'}
            onPress={handleSave}
            loading={saving}
            disabled={locked}
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
  noProjects: { fontSize: 12, color: Colors.danger, marginTop: -8 },
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
