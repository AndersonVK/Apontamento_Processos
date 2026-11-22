import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import {
  getPendingSync,
  markSynced,
  incrementRetry,
  OfflineApontamento,
} from './offline';

const MAX_SERVER_REJECTIONS = 5;

export { onQueueChange, notifyQueueChange } from './events';
import { notifyQueueChange } from './events';
import { getOutbox, removeOp, markRejected, CONFLICT_KEYS } from './outbox';

/** Erro sem código do Postgres/PostgREST = falha de rede (não é culpa do registro). */
export function isNetworkError(err: any): boolean {
  return !!err && !err.code && !err.status;
}

async function syncOne(item: OfflineApontamento): Promise<'ok' | 'network' | 'rejected'> {
  try {
    let apontamentoId: string | null = null;

    const { data, error } = await supabase
      .from('apontamentos')
      .insert({
        local_id: item.id,
        employee_id: item.employee_id,
        activity_id: item.activity_id,
        leader_id: item.leader_id,
        work_date: item.work_date,
        start_time: item.start_time,
        end_time: item.end_time,
        notes: item.notes,
      })
      .select('id')
      .single();

    if (error) {
      // 23505 = local_id já existe: uma tentativa anterior inseriu o registro mas
      // falhou depois. Reaproveita o registro em vez de duplicar.
      if (error.code === '23505') {
        const { data: existing, error: selErr } = await supabase
          .from('apontamentos')
          .select('id')
          .eq('local_id', item.id)
          .single();
        if (selErr || !existing) throw selErr ?? error;
        apontamentoId = existing.id;
      } else {
        throw error;
      }
    } else {
      apontamentoId = data.id;
    }

    const { count, error: cntErr } = await supabase
      .from('apontamento_field_values')
      .select('id', { count: 'exact', head: true })
      .eq('apontamento_id', apontamentoId);
    if (cntErr) throw cntErr;

    const fieldValues = Object.entries(item.field_values)
      .filter(([, v]) => v !== '')
      .map(([field_id, value]) => ({ apontamento_id: apontamentoId, field_id, value }));

    if ((count ?? 0) === 0 && fieldValues.length > 0) {
      const { error: fvError } = await supabase
        .from('apontamento_field_values')
        .insert(fieldValues);
      if (fvError) throw fvError;
    }

    await markSynced(item.id);
    return 'ok';
  } catch (err: any) {
    if (isNetworkError(err)) return 'network';
    await incrementRetry(item.id);
    return 'rejected';
  }
}

async function flushOutbox(): Promise<{ synced: number; failed: number }> {
  const ops = await getOutbox();
  let synced = 0;
  let failed = 0;
  for (const op of ops) {
    if (op.rejections >= MAX_SERVER_REJECTIONS) continue;
    try {
      if (op.op === 'upsert' && op.row) {
        const { error } = await supabase
          .from(op.table)
          .upsert(op.row, { onConflict: CONFLICT_KEYS[op.table] });
        if (error) throw error;
      } else if (op.op === 'delete' && op.match) {
        let q = supabase.from(op.table).delete();
        for (const [col, val] of Object.entries(op.match)) q = q.eq(col, val);
        const { error } = await q;
        if (error) throw error;
      }
      await removeOp(op.id);
      synced++;
    } catch (err: any) {
      if (isNetworkError(err)) break; // sem rede de verdade: tenta de novo depois
      await markRejected(op.id, err?.message ?? 'Erro desconhecido');
      failed++;
    }
  }
  return { synced, failed };
}

let running = false;
let rerun = false; // um gatilho chegou durante um envio em andamento: repete ao terminar

export async function syncPending(): Promise<{ synced: number; failed: number }> {
  if (running) {
    rerun = true;
    return { synced: 0, failed: 0 };
  }
  running = true;
  try {
    const state = await NetInfo.fetch();
    if (state.isConnected === false) return { synced: 0, failed: 0 };

    const pending = await getPendingSync();
    let synced = 0;
    let failed = 0;

    for (const item of pending) {
      if (item.retry_count >= MAX_SERVER_REJECTIONS) continue;
      const result = await syncOne(item);
      if (result === 'ok') synced++;
      else failed++;
      if (result === 'network') break; // sem rede de verdade: tenta de novo depois
    }

    const outboxResult = await flushOutbox();
    synced += outboxResult.synced;
    failed += outboxResult.failed;

    if (synced > 0) notifyQueueChange();
    return { synced, failed };
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      syncPending().catch(() => {});
    }
  }
}
