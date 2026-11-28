import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { Profile } from '../../../../types';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { Button } from '../../../../components/ui/Button';
import { ScheduleFields, ScheduleValue, validateSchedule } from '../../../../components/apontamento/ScheduleFields';
import { shortTime, localDateIso } from '../../../../lib/date';
import { EffectiveDateField } from '../../../../components/apontamento/EffectiveDateField';
import { useChangeMinDate } from '../../../../hooks/useChangeMinDate';
import { Colors } from '../../../../constants/colors';
import { showMessage, confirmAction } from '../../../../lib/dialog';

export default function EquipeFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const [name, setName] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [previousLeaderId, setPreviousLeaderId] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [schedule, setSchedule] = useState<ScheduleValue>({ start: '07:00', end: '17:00', breakStart: '12:00', breakEnd: '13:00' });
  const [scheduleError, setScheduleError] = useState('');
  const [origSchedule, setOrigSchedule] = useState<ScheduleValue | null>(null);
  const [effDate, setEffDate] = useState(localDateIso());

  useEffect(() => {
    (async () => {
      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['leader', 'manager'])
        .order('name');
      setCandidates((profs as Profile[]) ?? []);
      if (!isNew) {
        const { data: t } = await supabase.from('teams').select('*').eq('id', id).single();
        if (t) {
          setName(t.name);
          setLeaderId(t.leader_id ?? '');
          setPreviousLeaderId(t.leader_id ?? '');
          const sched: ScheduleValue = {
            start: shortTime(t.shift_start ?? '07:00'),
            end: shortTime(t.shift_end ?? '17:00'),
            breakStart: shortTime(t.break_start ?? ''),
            breakEnd: shortTime(t.break_end ?? ''),
          };
          setSchedule(sched);
          setOrigSchedule(sched);
        }
      }
    })();
  }, [id, isNew]);

  const scheduleChanged = !isNew && !!origSchedule && JSON.stringify(schedule) !== JSON.stringify(origSchedule);
  const minDate = useChangeMinDate(isNew ? [] : [id as string]);
  const today = localDateIso();
  const closedToday = !!minDate && minDate > today;
  useEffect(() => {
    if (minDate && minDate <= today && effDate < minDate) setEffDate(minDate);
  }, [minDate]);

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Nome obrigatório');
      return;
    }
    const schedErr = validateSchedule(schedule);
    setScheduleError(schedErr);
    if (schedErr) return;
    if (scheduleChanged && closedToday) {
      showMessage('Dia fechado', 'O dia de hoje já está fechado para esta equipe. Reabra o dia antes de mudar a jornada.');
      return;
    }
    setSaving(true);
    try {
      let teamId = isNew ? '' : (id as string);
      // na criação a jornada entra junto; na edição, mudar a jornada cria uma NOVA versão com data
      const payload = {
        name: name.trim(),
        leader_id: leaderId || null,
        ...(isNew
          ? {
              shift_start: schedule.start,
              shift_end: schedule.end,
              break_start: schedule.breakStart || null,
              break_end: schedule.breakEnd || null,
            }
          : {}),
      };

      if (!isNew && scheduleChanged) {
        const { error } = await supabase.rpc('set_team_schedule', {
          p_team: teamId,
          p_start: schedule.start,
          p_end: schedule.end,
          p_bs: schedule.breakStart || null,
          p_be: schedule.breakEnd || null,
          p_effective: effDate,
        });
        if (error) throw error;
      }

      if (isNew) {
        const { data, error } = await supabase.from('teams').insert(payload).select('id').single();
        if (error) throw error;
        teamId = data.id;
      } else {
        const { error } = await supabase.from('teams').update(payload).eq('id', teamId);
        if (error) throw error;
      }

      // o líder passa a pertencer à equipe (é o team_id do perfil que define "minha equipe")
      if (leaderId) {
        const { error } = await supabase.from('profiles').update({ team_id: teamId }).eq('id', leaderId);
        if (error) throw error;
      }
      // líder anterior deixa de apontar para esta equipe
      if (previousLeaderId && previousLeaderId !== leaderId) {
        await supabase.from('profiles').update({ team_id: null }).eq('id', previousLeaderId).eq('team_id', teamId);
      }
      router.back();
    } catch (e: any) {
      showMessage('Erro', e?.message ?? 'Não foi possível salvar a equipe.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{isNew ? 'Nova equipe' : 'Editar equipe'}</Text>
      <Input
        label="Nome da equipe"
        value={name}
        onChangeText={(v) => { setName(v); setNameError(''); }}
        placeholder="Ex: Equipe Colheita A"
        error={nameError}
        required
      />
      <Select
        label="Líder"
        placeholder="Sem líder"
        options={[{ label: 'Sem líder', value: '' }, ...candidates.map((p) => ({ label: p.name, value: p.id }))]}
        value={leaderId}
        onChange={setLeaderId}
      />
      <Text style={styles.sectionTitle}>Jornada padrão da equipe</Text>
      <ScheduleFields value={schedule} onChange={(v) => { setSchedule(v); setScheduleError(''); }} error={scheduleError} />
      {scheduleChanged && (
        <EffectiveDateField
          value={effDate}
          onChange={setEffDate}
          minDate={minDate && minDate <= today ? minDate : undefined}
          label="Nova jornada vale a partir de"
          hint="Os dias anteriores continuam com a jornada que tinham."
        />
      )}
      {scheduleChanged && closedToday && (
        <Text style={styles.hint}>O dia de hoje já está fechado: reabra o dia para mudar a jornada.</Text>
      )}
      <Text style={styles.hint}>
        Só aparecem quem tem perfil Líder ou Gerente. Para alguém aparecer aqui, defina o perfil em Configurações → Usuários.
        Os funcionários entram na equipe pela tela Funcionários.
      </Text>
      <Button title="Salvar" onPress={handleSave} loading={saving} fullWidth size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  hint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
