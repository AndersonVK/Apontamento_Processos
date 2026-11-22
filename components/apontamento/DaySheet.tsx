import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { Sheet, CheckRow } from '../ui/Sheet';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { TimePicker } from '../ui/TimePicker';
import { Team, TeamDay } from '../../types';
import { durationMinutes, shortTime } from '../../lib/date';
import { Colors } from '../../constants/colors';

interface Props {
  visible: boolean;
  team: Team | null;
  teamDay: TeamDay | null;
  onClose: () => void;
  onSave: (patch: Record<string, any>) => void;
}

/** Opções do dia da equipe: dia sem trabalho e/ou horário diferente só neste dia. */
export function DaySheet({ visible, team, teamDay, onClose, onSave }: Props) {
  const [noWork, setNoWork] = useState(false);
  const [reason, setReason] = useState('');
  const [custom, setCustom] = useState(false);
  const [start, setStart] = useState('07:00');
  const [end, setEnd] = useState('17:00');
  const [bStart, setBStart] = useState('12:00');
  const [bEnd, setBEnd] = useState('13:00');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;
    setNoWork(!!teamDay?.no_work);
    setReason(teamDay?.reason ?? '');
    setCustom(!!teamDay?.custom_schedule);
    const src = teamDay?.custom_schedule ? teamDay : team;
    setStart(shortTime(src?.shift_start ?? '07:00'));
    setEnd(shortTime(src?.shift_end ?? '17:00'));
    setBStart(shortTime(src?.break_start ?? ''));
    setBEnd(shortTime(src?.break_end ?? ''));
    setError('');
  }, [visible, team, teamDay]);

  function save() {
    if (custom && !noWork) {
      if (!start || !end || durationMinutes(start, end) === null) {
        setError('O fim do expediente deve ser depois do início');
        return;
      }
      if (!!bStart !== !!bEnd) {
        setError('Informe início e fim do almoço, ou deixe os dois em branco');
        return;
      }
      if (bStart && bEnd && durationMinutes(bStart, bEnd) === null) {
        setError('O fim do almoço deve ser depois do início');
        return;
      }
    }
    onSave({
      no_work: noWork,
      reason: noWork ? reason.trim() || null : null,
      custom_schedule: custom,
      shift_start: custom ? start : null,
      shift_end: custom ? end : null,
      break_start: custom && bStart ? bStart : null,
      break_end: custom && bEnd ? bEnd : null,
    });
  }

  return (
    <Sheet visible={visible} title="Opções do dia" onClose={onClose}>
      <CheckRow label="Dia sem trabalho (a equipe toda)" checked={noWork} onPress={() => { setNoWork((v) => !v); setError(''); }} />
      {noWork && (
        <Input label="Motivo (opcional)" value={reason} onChangeText={setReason} placeholder="Ex.: chuva, feriado" />
      )}
      {!noWork && (
        <>
          <CheckRow label="Horário diferente só neste dia" checked={custom} onPress={() => { setCustom((v) => !v); setError(''); }} />
          {custom && (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}><TimePicker label="Início" value={start} onChange={setStart} /></View>
                <View style={{ flex: 1 }}><TimePicker label="Fim" value={end} onChange={setEnd} /></View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}><TimePicker label="Almoço de" value={bStart} onChange={setBStart} /></View>
                <View style={{ flex: 1 }}><TimePicker label="Almoço até" value={bEnd} onChange={setBEnd} /></View>
              </View>
              <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
                Funcionários com jornada própria continuam com o horário deles.
              </Text>
            </View>
          )}
        </>
      )}
      {error ? <Text style={{ color: Colors.danger, fontSize: 13 }}>{error}</Text> : null}
      <Button title="Salvar" onPress={save} fullWidth size="lg" />
    </Sheet>
  );
}
