// Datas no fuso LOCAL do aparelho (toISOString usa UTC e vira "amanhã" à noite no Brasil).

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function localDateIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function daysAgoIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateIso(d);
}

/** "07:00:00" -> "07:00" (o Postgres devolve TIME com segundos). */
export function shortTime(t: string): string {
  return (t ?? '').slice(0, 5);
}

export function toMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? '');
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutos entre início e fim, ou null se inválido (fim não depois do início). */
export function durationMinutes(start: string, end: string): number | null {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null || e <= s) return null;
  return e - s;
}

export function formatDuration(start: string, end: string): string {
  const d = durationMinutes(start, end);
  if (d === null) return '';
  const h = Math.floor(d / 60);
  const m = d % 60;
  return m ? `${h}h${pad(m)}` : `${h}h`;
}

export function formatDateBr(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** "2026-11-28" -> Date no fuso local (evita o deslocamento do UTC). */
export function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return localDateIso(d);
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

export function monthName(monthIndex: number): string {
  return MONTHS[monthIndex] ?? '';
}

/** "sáb, 28/11" (com o ano se não for o ano atual). */
export function formatDateLabel(iso: string): string {
  const d = parseLocalDate(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear() !== new Date().getFullYear() ? `/${d.getFullYear()}` : '';
  return `${WEEKDAYS[d.getDay()]}, ${dd}/${mm}${year}`;
}

export function isFutureDate(iso: string): boolean {
  return iso > localDateIso();
}
