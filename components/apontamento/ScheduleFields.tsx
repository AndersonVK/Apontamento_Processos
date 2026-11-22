import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TimePicker } from '../ui/TimePicker';
import { durationMinutes } from '../../lib/date';
import { Colors } from '../../constants/colors';

export interface ScheduleValue {
  start: string;
  end: string;
  breakStart: string;
  breakEnd: string;
}

export function validateSchedule(v: ScheduleValue): string {
  if (!v.start || !v.end || durationMinutes(v.start, v.end) === null) {
    return 'O fim do expediente deve ser depois do início';
  }
  if (!!v.breakStart !== !!v.breakEnd) {
    return 'Informe início e fim do almoço, ou deixe os dois em branco (sem pausa)';
  }
  if (v.breakStart && v.breakEnd) {
    if (durationMinutes(v.breakStart, v.breakEnd) === null) return 'O fim do almoço deve ser depois do início';
    if (v.breakStart < v.start || v.breakEnd > v.end) return 'O almoço deve estar dentro do expediente';
  }
  return '';
}

/** Início/fim do expediente e almoço (opcional). */
export function ScheduleFields({
  value,
  onChange,
  error,
}: {
  value: ScheduleValue;
  onChange: (v: ScheduleValue) => void;
  error?: string;
}) {
  const set = (patch: Partial<ScheduleValue>) => onChange({ ...value, ...patch });
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}><TimePicker label="Início" value={value.start} onChange={(v) => set({ start: v })} /></View>
        <View style={{ flex: 1 }}><TimePicker label="Fim" value={value.end} onChange={(v) => set({ end: v })} /></View>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}><TimePicker label="Almoço de" value={value.breakStart} onChange={(v) => set({ breakStart: v })} /></View>
        <View style={{ flex: 1 }}><TimePicker label="Almoço até" value={value.breakEnd} onChange={(v) => set({ breakEnd: v })} /></View>
      </View>
      <Text style={styles.hint}>Deixe o almoço em branco se não houver pausa. O horário do almoço não conta como horário sem apontar.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  hint: { fontSize: 12, color: Colors.textSecondary },
  error: { fontSize: 13, color: Colors.danger },
});
