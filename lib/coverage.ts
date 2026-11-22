// Lógica pura da "chamada do dia": o que foi apontado cobre a jornada esperada?
// Sem dependências do app para poder ser testada isoladamente.
// Tudo em minutos desde 00:00. Não há suporte a turno que cruza a meia-noite.

export interface Schedule {
  start: string; // "07:00"
  end: string; // "17:00"
  breakStart: string | null;
  breakEnd: string | null;
}

export interface Block {
  start: string;
  end: string;
  kind: 'work' | 'idle';
}

export interface Interval {
  start: number;
  end: number;
}

export type DayStatus = 'no_work' | 'absent' | 'none' | 'partial' | 'complete';

export interface Analysis {
  window: Interval; // jornada completa (início-fim)
  expected: Interval[]; // jornada sem a pausa
  expectedMinutes: number;
  coveredMinutes: number;
  gaps: Interval[]; // horário esperado sem nada apontado
  overlaps: Interval[]; // trechos apontados mais de uma vez
  extraMinutes: number; // apontado fora da jornada (hora extra)
}

export const DEFAULT_SCHEDULE: Schedule = {
  start: '07:00',
  end: '17:00',
  breakStart: '12:00',
  breakEnd: '13:00',
};

export function toMin(t: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function fmtMin(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function sumIntervals(list: Interval[]): number {
  return list.reduce((acc, i) => acc + (i.end - i.start), 0);
}

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list
    .filter((i) => i.end > i.start)
    .map((i) => ({ ...i }))
    .sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const cur of sorted) {
    const last = out[out.length - 1];
    if (last && cur.start <= last.end) last.end = Math.max(last.end, cur.end);
    else out.push(cur);
  }
  return out;
}

/** a - b (ambos já mesclados e ordenados). */
export function subtractIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const seg of a) {
    let pieces: Interval[] = [{ ...seg }];
    for (const cut of b) {
      const next: Interval[] = [];
      for (const p of pieces) {
        if (cut.end <= p.start || cut.start >= p.end) {
          next.push(p);
          continue;
        }
        if (cut.start > p.start) next.push({ start: p.start, end: cut.start });
        if (cut.end < p.end) next.push({ start: cut.end, end: p.end });
      }
      pieces = next;
    }
    out.push(...pieces);
  }
  return out;
}

export function intersectIntervals(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = [];
  for (const x of a) {
    for (const y of b) {
      const s = Math.max(x.start, y.start);
      const e = Math.min(x.end, y.end);
      if (e > s) out.push({ start: s, end: e });
    }
  }
  return mergeIntervals(out);
}

export function expectedIntervals(schedule: Schedule): Interval[] {
  const s = toMin(schedule.start);
  const e = toMin(schedule.end);
  if (s === null || e === null || e <= s) return [];
  const bs = toMin(schedule.breakStart);
  const be = toMin(schedule.breakEnd);
  const window: Interval[] = [{ start: s, end: e }];
  if (bs !== null && be !== null && be > bs) {
    return subtractIntervals(window, [{ start: bs, end: be }]);
  }
  return window;
}

export function analyze(schedule: Schedule, blocks: Block[]): Analysis {
  const expected = expectedIntervals(schedule);
  const s = toMin(schedule.start) ?? 0;
  const e = toMin(schedule.end) ?? 0;
  const window: Interval = { start: s, end: e };

  const intervals: Interval[] = blocks
    .map((b) => ({ start: toMin(b.start), end: toMin(b.end) }))
    .filter((i): i is Interval => i.start !== null && i.end !== null && i.end > i.start);

  const union = mergeIntervals(intervals);
  const coveredInShift = intersectIntervals(union, expected);
  const gaps = subtractIntervals(expected, coveredInShift);

  // sobreposição: trechos cobertos por mais de um bloco
  const overlapParts: Interval[] = [];
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const st = Math.max(intervals[i].start, intervals[j].start);
      const en = Math.min(intervals[i].end, intervals[j].end);
      if (en > st) overlapParts.push({ start: st, end: en });
    }
  }

  const outside = subtractIntervals(union, [window]);

  return {
    window,
    expected,
    expectedMinutes: sumIntervals(expected),
    coveredMinutes: sumIntervals(coveredInShift),
    gaps,
    overlaps: mergeIntervals(overlapParts),
    extraMinutes: sumIntervals(outside),
  };
}

export function dayStatus(args: {
  noWork: boolean;
  absent: boolean;
  blockCount: number;
  analysis: Analysis;
}): DayStatus {
  if (args.noWork) return 'no_work';
  if (args.absent) return 'absent';
  if (args.blockCount === 0) return 'none';
  return args.analysis.gaps.length > 0 ? 'partial' : 'complete';
}

type ScheduleFields = {
  shift_start?: string | null;
  shift_end?: string | null;
  break_start?: string | null;
  break_end?: string | null;
};

function fromFields(f: ScheduleFields | null | undefined): Schedule | null {
  if (!f?.shift_start || !f?.shift_end) return null;
  return {
    start: f.shift_start.slice(0, 5),
    end: f.shift_end.slice(0, 5),
    breakStart: f.break_start ? f.break_start.slice(0, 5) : null,
    breakEnd: f.break_end ? f.break_end.slice(0, 5) : null,
  };
}

/**
 * Qual jornada vale para um funcionário num dia:
 * 1) jornada própria do funcionário; 2) exceção daquele dia da equipe;
 * 3) padrão da equipe; 4) padrão do sistema (07-17, almoço 12-13).
 */
export function resolveSchedule(
  team: ScheduleFields | null | undefined,
  employee: (ScheduleFields & { custom_schedule?: boolean }) | null | undefined,
  teamDay: (ScheduleFields & { custom_schedule?: boolean }) | null | undefined
): Schedule {
  if (employee?.custom_schedule) {
    const s = fromFields(employee);
    if (s) return s;
  }
  if (teamDay?.custom_schedule) {
    const s = fromFields(teamDay);
    if (s) return s;
  }
  return fromFields(team) ?? DEFAULT_SCHEDULE;
}
