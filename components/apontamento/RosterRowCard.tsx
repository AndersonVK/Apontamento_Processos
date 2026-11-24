import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RosterRow, RosterRecord } from '../../hooks/useRoster';
import { DayStatus, Interval, fmtDuration, fmtMin } from '../../lib/coverage';
import { TimelineBar, IDLE_COLOR } from './TimelineBar';
import { ABSENCE_LABELS } from './AbsenceSheet';
import { IDLE_LABELS } from './IdleSheet';
import { Colors } from '../../constants/colors';

const STATUS: Record<DayStatus, { label: string; bg: string; fg: string }> = {
  none: { label: 'Sem apontamento', bg: Colors.gray100, fg: Colors.gray600 },
  partial: { label: 'Parcial', bg: Colors.warningLight, fg: '#b45309' },
  complete: { label: 'Completo', bg: Colors.primaryLight, fg: Colors.primaryDark },
  absent: { label: 'Falta', bg: Colors.dangerLight, fg: Colors.danger },
  no_work: { label: 'Sem trabalho', bg: Colors.gray100, fg: Colors.gray500 },
};

const gapText = (gaps: Interval[]) => gaps.map((g) => `${fmtMin(g.start)}–${fmtMin(g.end)}`).join(' e ');

interface Props {
  row: RosterRow;
  expanded: boolean;
  onToggle: () => void;
  selectMode: boolean;
  selected: boolean;
  canOpenRecord: (r: RosterRecord) => boolean;
  onOpenRecord: (r: RosterRecord) => void;
  onAdd: (gap?: Interval) => void;
  onJustify: (gap?: Interval) => void;
  onAbsence: () => void;
  onDeleteIdle: (id: string) => void;
}

export function RosterRowCard({
  row, expanded, onToggle, selectMode, selected, canOpenRecord, onOpenRecord,
  onAdd, onJustify, onAbsence, onDeleteIdle,
}: Props) {
  const st = STATUS[row.status];
  const { analysis } = row;
  const showBar = row.status !== 'absent' && row.status !== 'no_work';
  const selectable = row.status !== 'absent' && row.status !== 'no_work';

  let line = '';
  let lineColor: string = Colors.textSecondary;
  if (row.status === 'none') line = 'Nada apontado ainda';
  if (row.status === 'partial') {
    const missing = analysis.expectedMinutes - analysis.coveredMinutes;
    line = `⚠ Faltam ${fmtDuration(missing)} (${gapText(analysis.gaps)})`;
    lineColor = '#b45309';
  }
  if (row.status === 'complete') line = `Jornada coberta · ${fmtDuration(analysis.coveredMinutes)}`;
  if (row.status === 'absent' && row.absence) {
    line = `${ABSENCE_LABELS[row.absence.reason_type]}${row.absence.note ? ` · ${row.absence.note}` : ''}`;
    lineColor = Colors.danger;
  }
  if (row.status === 'no_work') line = 'Dia sem trabalho';

  return (
    <View style={[styles.card, selected && styles.cardSelected]}>
      <Pressable onPress={selectMode ? (selectable ? onToggle : undefined) : onToggle} style={styles.top}>
        {selectMode && (
          <View style={[styles.check, selected && styles.checkOn, !selectable && { opacity: 0.3 }]}>
            {selected && <Ionicons name="checkmark" size={14} color={Colors.white} />}
          </View>
        )}
        <View style={[styles.avatar, { backgroundColor: st.bg }]}>
          <Text style={[styles.avatarText, { color: st.fg }]}>{row.employee.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{row.employee.name}</Text>
          {row.borrowed && (
            <Text style={styles.borrowed}>Emprestado{row.employee.teamName ? ` de ${row.employee.teamName}` : ''}</Text>
          )}
        </View>
        <View style={[styles.chip, { backgroundColor: st.bg }]}>
          <Text style={[styles.chipText, { color: st.fg }]}>{st.label}</Text>
        </View>
        {!selectMode && (
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.gray300} />
        )}
      </Pressable>

      {showBar && (
        <View style={styles.bar}>
          <TimelineBar
            schedule={row.schedule}
            analysis={analysis}
            status={row.status}
            segments={[
              ...row.records.map((r) => ({ start: r.start, end: r.end, kind: 'work' as const })),
              ...row.idle.map((b) => ({ start: b.start_time, end: b.end_time, kind: 'idle' as const })),
            ]}
          />
        </View>
      )}

      {line ? <Text style={[styles.line, { color: lineColor }]}>{line}</Text> : null}
      {analysis.overlaps.length > 0 && (
        <Text style={styles.overlap}>⚠ Horários sobrepostos: {gapText(analysis.overlaps)}</Text>
      )}

      {expanded && !selectMode && (
        <View style={styles.detail}>
          {row.records.map((r) => {
            const clickable = canOpenRecord(r);
            return (
              <Pressable key={r.id} disabled={!clickable} onPress={() => onOpenRecord(r)} style={styles.rec}>
                <View style={[styles.recDot, { backgroundColor: Colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recTitle}>
                    {r.start}–{r.end} · {r.activityName}
                    {!r.synced ? '  (pendente)' : ''}
                  </Text>
                  <Text style={styles.recSub}>Projeto: {r.projectName}</Text>
                  {r.summary ? <Text style={styles.recSub}>{r.summary}</Text> : null}
                  {!r.mine && <Text style={styles.recSub}>Apontado por {r.leaderName}</Text>}
                </View>
                {clickable && <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />}
              </Pressable>
            );
          })}

          {row.idle.map((b) => (
            <View key={b.id} style={styles.rec}>
              <View style={[styles.recDot, { backgroundColor: IDLE_COLOR }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.recTitle}>
                  {b.start_time}–{b.end_time} · {IDLE_LABELS[b.reason_type]}
                </Text>
                {b.note ? <Text style={styles.recSub}>{b.note}</Text> : null}
              </View>
              <Pressable onPress={() => onDeleteIdle(b.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </Pressable>
            </View>
          ))}

          {row.status === 'partial' &&
            analysis.gaps.map((g, i) => (
              <View key={i} style={styles.gapRow}>
                <Text style={styles.gapText}>Sem apontar: {fmtMin(g.start)}–{fmtMin(g.end)}</Text>
                <Pressable style={styles.gapBtn} onPress={() => onAdd(g)}>
                  <Text style={styles.gapBtnText}>Lançar</Text>
                </Pressable>
                <Pressable style={[styles.gapBtn, styles.gapBtnAlt]} onPress={() => onJustify(g)}>
                  <Text style={[styles.gapBtnText, { color: Colors.gray700 }]}>Justificar</Text>
                </Pressable>
              </View>
            ))}

          <View style={styles.actions}>
            {row.status !== 'absent' && (
              <Pressable style={styles.actPrimary} onPress={() => onAdd()}>
                <Ionicons name="add" size={16} color={Colors.white} />
                <Text style={styles.actPrimaryText}>Lançar</Text>
              </Pressable>
            )}
            {row.status !== 'absent' && (
              <Pressable style={styles.act} onPress={() => onJustify()}>
                <Text style={styles.actText}>Justificar horário</Text>
              </Pressable>
            )}
            <Pressable style={styles.act} onPress={onAbsence}>
              <Text style={[styles.actText, { color: Colors.danger }]}>
                {row.absence ? 'Editar falta' : 'Falta'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  cardSelected: { borderColor: Colors.primary, backgroundColor: '#f0fdf4' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700', fontSize: 15 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.text },
  borrowed: { fontSize: 11, color: '#2563eb', marginTop: 1 },
  chip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  chipText: { fontSize: 11, fontWeight: '700' },
  bar: { paddingHorizontal: 2 },
  line: { fontSize: 12, fontWeight: '500' },
  overlap: { fontSize: 12, color: Colors.danger, fontWeight: '500' },
  detail: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border, paddingTop: 8, gap: 8 },
  rec: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  recTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  recSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  gapRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.warningLight,
    borderRadius: 8, padding: 8,
  },
  gapText: { flex: 1, fontSize: 12, color: '#92400e', fontWeight: '600' },
  gapBtn: { backgroundColor: Colors.primary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  gapBtnAlt: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border },
  gapBtnText: { fontSize: 12, fontWeight: '700', color: Colors.white },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  actPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  actPrimaryText: { color: Colors.white, fontWeight: '700', fontSize: 13 },
  act: {
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: Colors.gray100,
  },
  actText: { fontSize: 13, fontWeight: '600', color: Colors.gray700 },
});
