import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Sheet, RadioRow } from '../ui/Sheet';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Absence, AbsenceReason } from '../../types';
import { Colors } from '../../constants/colors';

export const ABSENCE_LABELS: Record<AbsenceReason, string> = {
  atestado: 'Atestado',
  sem_justificativa: 'Sem justificativa',
  outro: 'Outro',
};

interface Props {
  visible: boolean;
  employeeName: string;
  existing: Absence | null;
  onClose: () => void;
  onSave: (reason: AbsenceReason, note: string) => void;
  onRemove: () => void;
}

export function AbsenceSheet({ visible, employeeName, existing, onClose, onSave, onRemove }: Props) {
  const [reason, setReason] = useState<AbsenceReason>('sem_justificativa');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setReason(existing?.reason_type ?? 'sem_justificativa');
      setNote(existing?.note ?? '');
      setError('');
    }
  }, [visible, existing]);

  function save() {
    if (reason === 'outro' && !note.trim()) {
      setError('Descreva o motivo');
      return;
    }
    onSave(reason, note);
  }

  return (
    <Sheet visible={visible} title={`Falta: ${employeeName}`} onClose={onClose}>
      {(Object.keys(ABSENCE_LABELS) as AbsenceReason[]).map((r) => (
        <RadioRow key={r} label={ABSENCE_LABELS[r]} selected={reason === r} onPress={() => { setReason(r); setError(''); }} />
      ))}
      <Input
        label={reason === 'outro' ? 'Motivo' : 'Observação (opcional)'}
        value={note}
        onChangeText={(v) => { setNote(v); setError(''); }}
        placeholder={reason === 'outro' ? 'Escreva o motivo' : ''}
        required={reason === 'outro'}
        error={error}
      />
      <Button title="Registrar falta" onPress={save} fullWidth size="lg" />
      {existing && <Button title="Remover falta" onPress={onRemove} variant="secondary" fullWidth />}
      <Text style={{ fontSize: 12, color: Colors.textSecondary }}>
        A falta é um status do dia e não entra nos relatórios de produção.
      </Text>
    </Sheet>
  );
}
