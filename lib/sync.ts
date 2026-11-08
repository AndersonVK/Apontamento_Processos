import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import {
  getPendingSync,
  markSynced,
  incrementRetry,
  OfflineApontamento,
} from './offline';

const MAX_SERVER_REJECTIONS = 5;

type Listener = () => void;
const listeners = new Set<Listener>();

/** Avisa telas (ex.: lista) que a fila mudou ou que algo foi sincronizado. */
export function onQueueChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function notifyQueueChange() {
  listeners.forEach((cb) => cb());
}

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

let running = false;

export async function syncPending(): Promise<{ synced: number; failed: number }> {
  if (running) return { synced: 0, failed: 0 };
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

    if (synced > 0) notifyQueueChange();
    return { synced, failed };
  } finally {
    running = false;
  }
}
