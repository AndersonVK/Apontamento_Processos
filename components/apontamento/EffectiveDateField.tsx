import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CalendarSheet } from './CalendarSheet';
import { addDaysIso, formatDateLabel, localDateIso } from '../../lib/date';
import { Colors } from '../../constants/colors';

interface Props {
  value: string; // data escolhida (AAAA-MM-DD)
  onChange: (iso: string) => void;
  /** primeiro dia permitido: o dia seguinte ao último dia fechado (ou vazio = sem limite) */
  minDate?: string;
  label?: string;
  hint?: string;
}

/** "A partir de: hoje" — escolha da data em que uma mudança passa a valer. */
export function EffectiveDateField({ value, onChange, minDate, label = 'A partir de', hint }: Props) {
  const [open, setOpen] = useState(false);
  const today = localDateIso();
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.btn} onPress={() => setOpen(true)} accessibilityLabel="Escolher a data da mudança">
        <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
        <Text style={styles.value}>{value === today ? `hoje (${formatDateLabel(value)})` : formatDateLabel(value)}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.gray400} />
      </Pressable>
      <Text style={styles.hint}>
        {hint ?? 'A mudança vale desta data em diante; dias anteriores não são alterados.'}
        {minDate ? ` Dias até ${formatDateLabel(addDaysIso(minDate, -1))} já estão fechados.` : ''}
      </Text>
      <CalendarSheet
        visible={open}
        selected={value}
        teamId={null}
        showMarks={false}
        minDate={minDate}
        title={label}
        onSelect={(iso) => { onChange(iso); setOpen(false); }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6, backgroundColor: Colors.warningLight, borderRadius: 12, padding: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#92400e' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border,
  },
  value: { flex: 1, fontSize: 14, fontWeight: '600', color: Colors.text },
  hint: { fontSize: 12, color: '#92400e', lineHeight: 17 },
});
