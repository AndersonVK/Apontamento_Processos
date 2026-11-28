import React, { useCallback, useEffect, useState } from 'react';
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
import { Card } from '../../../components/ui/Card';
import { ScheduleFields, ScheduleValue, validateSchedule } from '../../../components/apontamento/ScheduleFields';
import { EffectiveDateField } from '../../../components/apontamento/EffectiveDateField';
import { useChangeMinDate } from '../../../hooks/useChangeMinDate';
import { shortTime, localDateIso } from '../../../lib/date';
import { describeRange } from '../../../lib/range';
import { Colors } from '../../../constants/colors';
import { showMessage, confirmAction } from '../../../lib/dialog';
import { formatCpf, onlyDigits, cpfError } from '../../../lib/cpf';
import { notifyEmployeesChanged } from '../../../lib/events';

interface HistoryRow {
  id: string;
  during: string;
  team: { name: string } | null;
}

const DEFAULT_SCHEDULE: ScheduleValue = { start: '07:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' };

function explain(e: { code?: string; message?: string }) {
  if (e?.code === '23505') return 'Já existe um funcionário com este CPF.';
  return e?.message ?? 'Não foi possível salvar.';
}

export default function EditFuncionarioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState('');
  const [cpf, setCpf] = useState('');
  const [hadCpf, setHadCpf] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [teamId, setTeamId] = useState('');
  const [origTeamId, setOrigTeamId] = useState('');
  const [custom, setCustom] = useState(false);
  const [origCustom, setOrigCustom] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleValue>(DEFAULT_SCHEDULE);
  const [origSchedule, setOrigSchedule] = useState<ScheduleValue>(DEFAULT_SCHEDULE);
  const [scheduleError, setScheduleError] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [effDate, setEffDate] = useState(localDateIso());

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('employee_team_history')
      .select('id, during, team:teams(name)')
      .eq('employee_id', id);
    const rows = ((data as any[]) ?? []).slice().sort((a, b) => String(a.during).localeCompare(String(b.during)));
    setHistory(rows as HistoryRow[]);
    setHistoryLoaded(true);
  }, [id]);

  useEffect(() => {
    Promise.all([
      supabase.from('employees').select('*').eq('id', id).single(),
      supabase.from('teams').select('*').order('name'),
    ]).then(([{ data: emp }, { data: tms }]) => {
      if (emp) {
        const sched: ScheduleValue = {
          start: shortTime(emp.shift_start ?? '07:00'),
          end: shortTime(emp.shift_end ?? '17:00'),
          breakStart: shortTime(emp.break_start ?? ''),
          breakEnd: shortTime(emp.break_end ?? ''),
        };
        setEmployee(emp);
        setName(emp.name);
        setRegistration(emp.registration ?? '');
        setTeamId(emp.team_id ?? '');
        setOrigTeamId(emp.team_id ?? '');
        setCpf(formatCpf(emp.cpf ?? ''));
        setHadCpf(!!emp.cpf);
        setCustom(!!emp.custom_schedule);
        setOrigCustom(!!emp.custom_schedule);
        setSchedule(sched);
        setOrigSchedule(sched);
      }
      setTeams(tms ?? []);
    });
    loadHistory();
  }, [id, loadHistory]);

  const today = localDateIso();
  const minDate = useChangeMinDate([origTeamId, teamId]);
  const closedToday = !!minDate && minDate > today; // hoje também está fechado: precisa reabrir o dia

  // a data escolhida nunca fica antes do primeiro dia permitido
  useEffect(() => {
    if (minDate && minDate <= today && effDate < minDate) setEffDate(minDate);
  }, [minDate]);

  const teamChanged = teamId !== origTeamId;
  const scheduleChanged =
    custom !== origCustom ||
    (custom && JSON.stringify(schedule) !== JSON.stringify(origSchedule));
  // primeira atribuição de equipe: vale desde o início (o banco decide)
  const isFirstAssignment = historyLoaded && history.length === 0 && !origTeamId && !!teamId;

  async function rpc(fn: string, args: Record<string, any>) {
    const { error } = await supabase.rpc(fn, args);
    if (error) throw error;
  }

  async function handleSave() {
    if (!name.trim() || !employee) return;
    const ce = cpfError(cpf);
    setErrors({ cpf: ce });
    if (ce) return;
    const schedErr = custom ? validateSchedule(schedule) : '';
    setScheduleError(schedErr);
    if (schedErr) return;
    if ((teamChanged && !isFirstAssignment) || scheduleChanged) {
      if (closedToday) {
        showMessage('Dia fechado', 'O dia de hoje já está fechado. Reabra o dia (ou peça a um gerente) para alterar equipe ou jornada.');
        return;
      }
    }

    setSaving(true);
    const done: string[] = [];
    try {
      // mudanças com data primeiro (são as que podem ser recusadas por dia fechado)
      if (teamChanged) {
        await rpc('set_employee_membership', {
          p_employee: id,
          p_team: teamId || null,
          p_active: employee.active,
          p_effective: isFirstAssignment ? null : effDate,
        });
        done.push('equipe');
      }
      if (scheduleChanged) {
        await rpc('set_employee_schedule', {
          p_employee: id,
          p_custom: custom,
          p_start: custom ? schedule.start : null,
          p_end: custom ? schedule.end : null,
          p_bs: custom && schedule.breakStart ? schedule.breakStart : null,
          p_be: custom && schedule.breakEnd ? schedule.breakEnd : null,
          p_effective: effDate,
        });
        done.push('jornada');
      }
      const { error } = await supabase
        .from('employees')
        .update({
          name: name.trim(),
          registration: registration.trim() || null,
          // CPF: só envia se preenchido ou se havia um e foi apagado
          ...(onlyDigits(cpf) || hadCpf ? { cpf: onlyDigits(cpf) || null } : {}),
        })
        .eq('id', id);
      if (error) throw error;
    } catch (e: any) {
      setSaving(false);
      showMessage('Erro', (done.length ? `Já foi salvo: ${done.join(' e ')}.\n\n` : '') + explain(e));
      loadHistory();
      return;
    }
    setSaving(false);
    notifyEmployeesChanged();
    router.back();
  }

  async function changeStatus(active: boolean) {
    if (!employee) return;
    const verb = active ? 'Reativar' : 'Desativar';
    if (closedToday) {
      showMessage('Dia fechado', 'O dia de hoje já está fechado. Reabra o dia (ou peça a um gerente) para mudar a situação.');
      return;
    }
    const ok = await confirmAction(
      verb,
      `${verb} ${employee.name} a partir de ${effDate === today ? 'hoje' : effDate.split('-').reverse().join('/')}? ${
        active ? '' : 'Ele continua aparecendo nos dias em que estava ativo.'
      }`,
      verb,
      !active
    );
    if (!ok) return;
    try {
      await rpc('set_employee_membership', {
        p_employee: id,
        p_team: employee.team_id ?? null,
        p_active: active,
        p_effective: effDate,
      });
    } catch (e: any) {
      showMessage('Erro', explain(e));
      return;
    }
    notifyEmployeesChanged();
    router.back();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Editar Funcionário</Text>
        {employee && !employee.active && <Text style={styles.inactive}>Funcionário inativo</Text>}

        <Input label="Nome completo" value={name} onChangeText={setName} required />
        <Input
          label="Matrícula"
          value={registration}
          onChangeText={setRegistration}
          placeholder="Opcional"
          keyboardType="numeric"
        />
        <Input
          label="CPF (opcional)"
          value={cpf}
          onChangeText={(v) => { setCpf(formatCpf(v)); setErrors((e) => ({ ...e, cpf: '' })); }}
          placeholder="000.000.000-00"
          keyboardType="number-pad"
          maxLength={14}
          error={errors.cpf}
        />
        <Select
          label="Equipe"
          placeholder="Sem equipe"
          options={[{ label: 'Sem equipe', value: '' }, ...teams.map((t) => ({ label: t.name, value: t.id }))]}
          value={teamId}
          onChange={setTeamId}
        />
        {isFirstAssignment && (
          <Text style={styles.note}>Primeira equipe deste funcionário: vale desde o início, sem data.</Text>
        )}

        <CheckRow
          label="Horário diferente do da equipe"
          checked={custom}
          onPress={() => { setCustom((v) => !v); setScheduleError(''); }}
        />
        {custom && (
          <ScheduleFields value={schedule} onChange={(v) => { setSchedule(v); setScheduleError(''); }} error={scheduleError} />
        )}

        {(((teamChanged && !isFirstAssignment) || scheduleChanged) || (employee && historyLoaded && history.length > 0)) && (
          <EffectiveDateField
            value={effDate}
            onChange={setEffDate}
            minDate={minDate && minDate <= today ? minDate : undefined}
            label="Mudanças de equipe, jornada ou situação valem a partir de"
          />
        )}
        {closedToday && (
          <Text style={styles.warn}>
            O dia de hoje já está fechado para a equipe. Para mudar equipe, jornada ou situação, reabra o dia primeiro.
          </Text>
        )}

        <Button title="Salvar" onPress={handleSave} loading={saving} fullWidth size="lg" />
        {employee?.active ? (
          <Button title="Desativar funcionário" onPress={() => changeStatus(false)} variant="danger" fullWidth />
        ) : (
          <Button title="Reativar funcionário" onPress={() => changeStatus(true)} variant="secondary" fullWidth />
        )}

        <Card style={{ gap: 6 }}>
          <Text style={styles.histTitle}>Histórico de equipes</Text>
          {!historyLoaded ? (
            <Text style={styles.histRow}>Carregando…</Text>
          ) : history.length === 0 ? (
            <Text style={styles.histRow}>Nunca esteve em uma equipe.</Text>
          ) : (
            history.map((h) => (
              <Text key={h.id} style={styles.histRow}>
                <Text style={styles.histTeam}>{h.team?.name ?? 'Equipe'}</Text> · {describeRange(h.during)}
              </Text>
            ))
          )}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  inactive: { fontSize: 13, fontWeight: '700', color: Colors.gray500 },
  note: { fontSize: 12, color: Colors.textSecondary, marginTop: -8 },
  warn: { fontSize: 13, color: Colors.danger, lineHeight: 18 },
  histTitle: { fontSize: 14, fontWeight: '700', color: Colors.text },
  histRow: { fontSize: 13, color: Colors.textSecondary },
  histTeam: { fontWeight: '700', color: Colors.text },
});
