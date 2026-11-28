import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDaysIso, formatDateLabel, localDateIso } from '../../lib/date';
import { Colors } from '../../constants/colors';

interface Props {
  date: string;
  onChange: (iso: string) => void;
  onOpenCalendar: () => void;
}

/** ◀ sáb, 28/11 ▾ ▶   [Hoje] [Ontem] — datas futuras são bloqueadas. */
export function DateBar({ date, onChange, onOpenCalendar }: Props) {
  const today = localDateIso();
  const yesterday = addDaysIso(today, -1);
  const atToday = date >= today;

  return (
    <View style={styles.row}>
      <Pressable style={styles.arrow} onPress={() => onChange(addDaysIso(date, -1))} accessibilityLabel="Dia anterior">
        <Ionicons name="chevron-back" size={20} color={Colors.gray700} />
      </Pressable>

      <Pressable style={styles.dateBtn} onPress={onOpenCalendar} accessibilityLabel="Escolher data">
        <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
        <Text style={styles.dateText}>{formatDateLabel(date)}</Text>
        <Ionicons name="chevron-down" size={14} color={Colors.gray400} />
      </Pressable>

      <Pressable
        style={[styles.arrow, atToday && styles.arrowOff]}
        disabled={atToday}
        onPress={() => onChange(addDaysIso(date, 1))}
        accessibilityLabel="Próximo dia"
      >
        <Ionicons name="chevron-forward" size={20} color={Colors.gray700} />
      </Pressable>

      <Pressable style={[styles.chip, date === today && styles.chipOn]} onPress={() => onChange(today)}>
        <Text style={[styles.chipText, date === today && styles.chipTextOn]}>Hoje</Text>
      </Pressable>
      <Pressable style={[styles.chip, date === yesterday && styles.chipOn]} onPress={() => onChange(yesterday)}>
        <Text style={[styles.chipText, date === yesterday && styles.chipTextOn]}>Ontem</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.white,
  },
  arrow: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  arrowOff: { opacity: 0.3 },
  dateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: Colors.primaryLight,
    backgroundColor: Colors.white, paddingHorizontal: 8,
  },
  dateText: { fontSize: 14, fontWeight: '700', color: Colors.text },
  chip: { paddingHorizontal: 10, height: 34, borderRadius: 17, justifyContent: 'center', backgroundColor: Colors.gray100 },
  chipOn: { backgroundColor: Colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.gray600 },
  chipTextOn: { color: Colors.white },
});
