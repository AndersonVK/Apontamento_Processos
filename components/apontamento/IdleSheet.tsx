import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Sheet, RadioRow } from '../ui/Sheet';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { TimePicker } from '../ui/TimePicker';
import { IdleReason } from '../../types';
import { durationMinutes } from '../../lib/date';

export const IDLE_LABELS: Record<IdleReason, string> = {
  parado: 'Parado',
  deslocamento: 'Deslocamento',
  chegou_atrasado: 'Chegou atrasado',
  saiu_mais_cedo: 'Saiu mais cedo',
  outro: 'Outro',
};

interface Props {
  visible: boolean;
  employeeName: string;
  defaultStart: string;
  defaultEnd: string;
  onClose: () => void;
  onSave: (start: string, end: string, reason: IdleReason, note: string) => void;
}

/** Justifica um horário sem atividade (parado, deslocamento...). Conta como horário coberto. */
export function IdleSheet({ visible, employeeName, defaultStart, defaultEnd, onClose, onSave }: Props) {
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [reason, setReason] = useState<IdleReason>('parado');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ time?: string; note?: string }>({});

  useEffect(() => {
    if (visible) {
      setStart(defaultStart);
      setEnd(defaultEnd);
      setReason('parado');
      setNote('');
      setErrors({});
    }
  }, [visible, defaultStart, defaultEnd]);

  function save() {
    const errs: typeof errors = {};
    if (!start || !end || durationMinutes(start, end) === null) errs.time = 'O término deve ser depois do início';
    if (reason === 'outro' && !note.trim()) errs.note = 'Descreva o motivo';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave(start, end, reason, note);
  }

  return (
    <Sheet visible={visible} title={`Justificar horário: ${employeeName}`} onClose={onClose}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TimePicker label="Início" value={start} onChange={(v) => { setStart(v); setErrors({}); }} />
        </View>
        <View style={{ flex: 1 }}>
          <TimePicker label="Término" value={end} onChange={(v) => { setEnd(v); setErrors({}); }} error={errors.time} />
        </View>
      </View>
      {(Object.keys(IDLE_LABELS) as IdleReason[]).map((r) => (
        <RadioRow key={r} label={IDLE_LABELS[r]} selected={reason === r} onPress={() => { setReason(r); setErrors({}); }} />
      ))}
      <Input
        label={reason === 'outro' ? 'Motivo' : 'Observação (opcional)'}
        value={note}
        onChangeText={(v) => { setNote(v); setErrors((e) => ({ ...e, note: undefined })); }}
        placeholder={reason === 'outro' ? 'Escreva o motivo' : ''}
        required={reason === 'outro'}
        error={errors.note}
      />
      <Button title="Salvar" onPress={save} fullWidth size="lg" />
    </Sheet>
  );
}
