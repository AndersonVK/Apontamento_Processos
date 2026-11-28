import { addDaysIso, formatDateBr } from './date';

/** Intervalo do Postgres "[2026-11-01,2026-11-20)" -> início/fim (fim exclusivo). */
export function parseDateRange(raw: string): { from: string | null; to: string | null } {
  const m = /^[\[(]([^,]*),([^\])]*)[\])]$/.exec(raw ?? '');
  if (!m) return { from: null, to: null };
  return { from: m[1] || null, to: m[2] || null };
}

/** "desde o início até 19/11/2026", "de 20/11/2026 até hoje" ... (o fim do intervalo é exclusivo). */
export function describeRange(raw: string): string {
  const { from, to } = parseDateRange(raw);
  const a = from ? `de ${formatDateBr(from)}` : 'desde o início';
  const b = to ? `até ${formatDateBr(addDaysIso(to, -1))}` : 'até hoje (atual)';
  return `${a} ${b}`;
}
