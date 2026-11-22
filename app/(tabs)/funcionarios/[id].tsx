import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Employee, Team } from '../../../types';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { CheckRow } from '../../../components/ui/Sheet';
import { ScheduleFields, ScheduleValue, validateSchedule } from '../../../components/apontamento/ScheduleFields';
import { shortTime } from '../../../lib/date';
import { Colors } from '../../../constants/colors';
import { showMessage, confirmAction } from '../../../lib/dialog';

export default function EditFuncionarioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState('');
  const [teamId, setTeamId] = useState('');
  const [custom, setCustom] = useState(false);
  const [wasCustom, setWasCustom] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleValue>({ start: '07:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' });
  const [scheduleError, setScheduleError] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('employees').select('*').eq('id', id).single(),
      supabase.from('teams').select('*').order('name'),
    ]).then(([{ data: emp }, { data: tms }]) => {
      if (emp) {
        setEmployee(emp);
        setName(emp.name);
        setRegistration(emp.registration ?? '');
        setTeamId(emp.team_id ?? '');
        setCustom(!!emp.custom_schedule);
        setWasCustom(!!emp.custom_schedule);
        setSchedule({
          start: shortTime(emp.shift_start ?? '07:00'),
          end: shortTime(emp.shift_end ?? '17:00'),
          breakStart: shortTime(emp.break_start ?? ''),
          breakEnd: shortTime(emp.break_end ?? ''),
        });
      }
      setTeams(tms ?? []);
    });
  }, [id]);

  async function handleSave() {
    if (!name.trim()) return;
    const schedErr = custom ? validateSchedule(schedule) : '';
    setScheduleError(schedErr);
    if (schedErr) return;
    setSaving(true);
    const { error } = await supabase.from('employees').update({
      name: name.trim(),
      registration: registration.trim() || null,
      team_id: teamId || null,
      // só mexe na jornada se é personalizada agora ou era antes (para poder desfazer)
      ...(custom || wasCustom
        ? {
            custom_schedule: custom,
            shift_start: custom ? schedule.start : null,
            shift_end: custom ? schedule.end : null,
            break_start: custom && schedule.breakStart ? schedule.breakStart : null,
            break_end: custom && schedule.breakEnd ? schedule.breakEnd : null,
          }
        : {}),
    }).eq('id', id);
    setSaving(false);
    if (error) {
      showMessage('Erro', error.message);
      return;
    }
    router.back();
  }

  async function handleDeactivate() {
    if (!(await confirmAction('Desativar', `Desativar ${employee?.name}?`, 'Desativar', true))) return;
    const { error } = await supabase.from('employees').update({ active: false }).eq('id', id);
    if (error) {
      showMessage('Erro', error.message);
      return;
    }
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Editar Funcionário</Text>

        <Input label="Nome completo" value={name} onChangeText={setName} required />
        <Input
          label="Matrícula"
          value={registration}
          onChangeText={setRegistration}
          placeholder="Opcional"
          keyboardType="numeric"
        />
        <Select
          label="Equipe"
          placeholder="Selecionar equipe..."
          options={teams.map((t) => ({ label: t.name, value: t.id }))}
          value={teamId}
          onChange={setTeamId}
        />

        <CheckRow
          label="Horário diferente do da equipe"
          checked={custom}
          onPress={() => { setCustom((v) => !v); setScheduleError(''); }}
        />
        {custom && (
          <ScheduleFields value={schedule} onChange={(v) => { setSchedule(v); setScheduleError(''); }} error={scheduleError} />
        )}

        <Button title="Salvar" onPress={handleSave} loading={saving} fullWidth size="lg" />
        <Button
          title="Desativar funcionário"
          onPress={handleDeactivate}
          variant="danger"
          fullWidth
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
});
