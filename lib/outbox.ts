import AsyncStorage from '@react-native-async-storage/async-storage';
import { notifyQueueChange } from './events';

// Fila genérica de alterações (faltas, lacunas justificadas, dia da equipe).
// Tudo é gravado aqui primeiro: a tela atualiza na hora e o envio acontece quando há rede.

export type OutboxTable = 'absences' | 'idle_blocks' | 'team_days';

export interface OutboxOp {
  id: string;
  table: OutboxTable;
  op: 'upsert' | 'delete';
  /** upsert: linha a gravar. delete: não usado. */
  row?: Record<string, any>;
  /** delete: filtro exato das colunas (ex.: { id } ou { employee_id, work_date }). */
  match?: Record<string, any>;
  created_at: string;
  rejections: number;
  last_error?: string;
}

export const CONFLICT_KEYS: Record<OutboxTable, string> = {
  absences: 'employee_id,work_date',
  idle_blocks: 'id',
  team_days: 'team_id,work_date',
};

const KEY = 'outbox_ops';

export function newId(): string {
  // UUID v4 (o servidor usa uuid; gerar no aparelho evita duplicar ao reenviar)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getOutbox(): Promise<OutboxOp[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

async function save(ops: OutboxOp[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(ops));
}

function sameKey(op: OutboxOp, table: OutboxTable, keyObj: Record<string, any>) {
  if (op.table !== table || op.op !== 'upsert') return false;
  return Object.entries(keyObj).every(([k, v]) => op.row?.[k] === v);
}

export async function enqueueUpsert(table: OutboxTable, row: Record<string, any>) {
  const keyCols = CONFLICT_KEYS[table].split(',');
  const keyObj = Object.fromEntries(keyCols.map((k) => [k, row[k]]));
  const ops = await getOutbox();
  const existing = ops.find((o) => sameKey(o, table, keyObj));
  if (existing) {
    // mescla com a alteração anterior ainda não enviada (ex.: sem_trabalho + depois fechar)
    existing.row = { ...existing.row, ...row };
    existing.rejections = 0;
    existing.last_error = undefined;
  } else {
    ops.push({
      id: newId(),
      table,
      op: 'upsert',
      row,
      created_at: new Date().toISOString(),
      rejections: 0,
    });
  }
  await save(ops);
  notifyQueueChange();
}

export async function enqueueDelete(table: OutboxTable, match: Record<string, any>) {
  let ops = await getOutbox();
  // se ainda há um "gravar" pendente para a mesma linha, ele deixa de valer
  ops = ops.filter((o) => !sameKey(o, table, match));
  ops.push({
    id: newId(),
    table,
    op: 'delete',
    match,
    created_at: new Date().toISOString(),
    rejections: 0,
  });
  await save(ops);
  notifyQueueChange();
}

export async function removeOp(id: string) {
  const ops = await getOutbox();
  await save(ops.filter((o) => o.id !== id));
  notifyQueueChange();
}

export async function markRejected(id: string, message: string) {
  const ops = await getOutbox();
  const op = ops.find((o) => o.id === id);
  if (op) {
    op.rejections += 1;
    op.last_error = message;
    await save(ops);
  }
}

/** Aplica as alterações pendentes por cima de uma lista vinda do servidor (para a tela mostrar na hora). */
export function overlayRows<T extends Record<string, any>>(
  serverRows: T[],
  table: OutboxTable,
  ops: OutboxOp[]
): T[] {
  const keyCols = CONFLICT_KEYS[table].split(',');
  const keyOf = (r: Record<string, any>) => keyCols.map((k) => String(r[k])).join('|');
  const map = new Map<string, T>(serverRows.map((r) => [keyOf(r), r]));
  for (const op of ops) {
    if (op.table !== table) continue;
    if (op.op === 'upsert' && op.row) {
      const k = keyOf(op.row);
      map.set(k, { ...(map.get(k) ?? {}), ...op.row } as T);
    } else if (op.op === 'delete' && op.match) {
      // delete por id remove direto; por (employee_id, work_date) remove a linha correspondente
      for (const [k, r] of Array.from(map.entries())) {
        if (Object.entries(op.match).every(([c, v]) => r[c] === v)) map.delete(k);
      }
    }
  }
  return Array.from(map.values());
}
