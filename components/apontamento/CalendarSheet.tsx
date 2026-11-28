import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '../ui/Sheet';
import { monthMatrix } from '../../lib/calendar';
import { localDateIso, monthName, parseLocalDate } from '../../lib/date';
import { useMonthOverview } from '../../hooks/useMonthOverview';
import { Colors } from '../../constants/colors';

interface Props {
  visible: boolean;
  selected: string;
  teamId: string | null;
  onSelect: (iso: string) => void;
  onClose: () => void;
}

const WEEK = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Calendário do mês. Marcadores: ✓ fechado · ● aberto (tem lançamentos) · – sem trabalho. */
export function CalendarSheet({ visible, selected, teamId, onSelect, onClose }: Props) {
  const today = localDateIso();
  const [view, setView] = useState(() => {
    const d = parseLocalDate(selected);
    return { y: d.getFullYear(), m: d.getMonth() };
  });

  useEffect(() => {
    if (visible) {
      const d = parseLocalDate(selected);
      setView({ y: d.getFullYear(), m: d.getMonth() });
    }
  }, [visible, selected]);

  const { marks } = useMonthOverview(teamId, view.y, view.m, visible);
  const now = parseLocalDate(today);
  const atCurrentMonth = view.y === now.getFullYear() && view.m === now.getMonth();

  function step(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const weeks = monthMatrix(view.y, view.m);

  return (
    <Sheet visible={visible} title="Escolher data" onClose={onClose}>
      <View style={styles.nav}>
        <Pressable style={styles.navBtn} onPress={() => step(-1)} accessibilityLabel="Mês anterior">
          <Ionicons name="chevron-back" size={20} color={Colors.gray700} />
        </Pressable>
        <Text style={styles.month}>
          {monthName(view.m)} {view.y}
        </Text>
        <Pressable
          style={[styles.navBtn, atCurrentMonth && { opacity: 0.3 }]}
          disabled={atCurrentMonth}
          onPress={() => step(1)}
          accessibilityLabel="Próximo mês"
        >
          <Ionicons name="chevron-forward" size={20} color={Colors.gray700} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEK.map((w, i) => (
          <Text key={i} style={styles.weekDay}>{w}</Text>
        ))}
      </View>

      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((iso, di) => {
            if (!iso) return <View key={di} style={styles.cell} />;
            const future = iso > today;
            const isSel = iso === selected;
            const mark = marks[iso];
            return (
              <Pressable
                key={di}
                disabled={future}
                style={[styles.cell, isSel && styles.cellSel, iso === today && !isSel && styles.cellToday, future && { opacity: 0.25 }]}
                onPress={() => onSelect(iso)}
                accessibilityLabel={iso}
              >
                <Text style={[styles.dayText, isSel && { color: Colors.white }]}>{Number(iso.slice(8))}</Text>
                {mark?.closed ? (
                  <Text style={[styles.mark, { color: isSel ? Colors.white : Colors.primary }]}>✓</Text>
                ) : mark?.no_work ? (
                  <Text style={[styles.mark, { color: isSel ? Colors.white : Colors.gray400 }]}>–</Text>
                ) : mark?.has_records ? (
                  <View style={[styles.dot, { backgroundColor: isSel ? Colors.white : '#f59e0b' }]} />
                ) : (
                  <View style={{ height: 10 }} />
                )}
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.legend}>
        <Text style={styles.legendText}><Text style={{ color: Colors.primary, fontWeight: '700' }}>✓</Text> fechado</Text>
        <Text style={styles.legendText}><Text style={{ color: '#f59e0b', fontWeight: '700' }}>●</Text> aberto (tem lançamentos)</Text>
        <Text style={styles.legendText}><Text style={{ fontWeight: '700' }}>–</Text> sem trabalho</Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  month: { fontSize: 16, fontWeight: '700', color: Colors.text },
  weekRow: { flexDirection: 'row' },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: Colors.gray400 },
  cell: { flex: 1, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 10, margin: 1 },
  cellSel: { backgroundColor: Colors.primary },
  cellToday: { borderWidth: 1.5, borderColor: Colors.primary },
  dayText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  mark: { fontSize: 11, fontWeight: '800', height: 12, lineHeight: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingTop: 4 },
  legendText: { fontSize: 12, color: Colors.textSecondary },
});
