import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Analysis, Interval, Schedule, fmtMin, toMin } from '../../lib/coverage';
import { DayStatus } from '../../lib/coverage';
import { Colors } from '../../constants/colors';

export const IDLE_COLOR = '#64748b';
const GAP_COLOR = '#fbbf24';

interface Seg {
  start: string;
  end: string;
  kind: 'work' | 'idle';
}

interface Props {
  schedule: Schedule;
  analysis: Analysis;
  segments: Seg[];
  status: DayStatus;
}

/** Linha do tempo da jornada: verde = apontado, cinza = parado/desloc., âmbar = FALTA apontar. */
export function TimelineBar({ schedule, analysis, segments, status }: Props) {
  const { window } = analysis;
  const span = window.end - window.start;
  if (span <= 0) return null;

  const pct = (m: number) => `${((Math.min(Math.max(m, window.start), window.end) - window.start) / span) * 100}%`;
  const width = (i: Interval) =>
    `${((Math.min(i.end, window.end) - Math.max(i.start, window.start)) / span) * 100}%`;
  const placed = (i: Interval, color: string, key: string, extra?: object) =>
    i.end > window.start && i.start < window.end ? (
      <View
        key={key}
        style={[styles.seg, { left: pct(i.start) as any, width: width(i) as any, backgroundColor: color }, extra]}
      />
    ) : null;

  const bs = toMin(schedule.breakStart);
  const be = toMin(schedule.breakEnd);

  return (
    <View>
      <View style={styles.track}>
        {status === 'partial' &&
          analysis.gaps.map((g, i) => placed(g, GAP_COLOR, `gap${i}`))}
        {segments.map((s, i) => {
          const a = toMin(s.start);
          const b = toMin(s.end);
          if (a === null || b === null) return null;
          return placed({ start: a, end: b }, s.kind === 'work' ? Colors.primary : IDLE_COLOR, `s${i}`);
        })}
        {analysis.overlaps.map((o, i) => placed(o, Colors.danger, `o${i}`))}
        {bs !== null && be !== null && be > bs &&
          placed({ start: bs, end: be }, 'rgba(255,255,255,0.85)', 'break')}
      </View>
      <View style={styles.labels}>
        <Text style={styles.label}>{fmtMin(window.start)}</Text>
        <Text style={styles.label}>{fmtMin(window.end)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.gray200,
    overflow: 'hidden',
    position: 'relative',
  },
  seg: { position: 'absolute', top: 0, bottom: 0 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  label: { fontSize: 10, color: Colors.gray400 },
});
