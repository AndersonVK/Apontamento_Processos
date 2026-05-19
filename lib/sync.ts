import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import {
  getPendingSync,
  markSynced,
  incrementRetry,
  OfflineApontamento,
} from './offline';

async function syncOne(item: OfflineApontamento): Promise<boolean> {
  try {
    const { data: apontamento, error } = await supabase
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

    if (error) throw error;

    const fieldValues = Object.entries(item.field_values).map(
      ([field_id, value]) => ({
        apontamento_id: apontamento.id,
        field_id,
        value,
      })
    );

    if (fieldValues.length > 0) {
      const { error: fvError } = await supabase
        .from('apontamento_field_values')
        .insert(fieldValues);
      if (fvError) throw fvError;
    }

    await markSynced(item.id);
    return true;
  } catch {
    await incrementRetry(item.id);
    return false;
  }
}

export async function syncPending(): Promise<{
  synced: number;
  failed: number;
}> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return { synced: 0, failed: 0 };

  const pending = await getPendingSync();
  let synced = 0;
  let failed = 0;

  for (const item of pending) {
    if (item.retry_count >= 5) continue;
    const ok = await syncOne(item);
    if (ok) synced++;
    else failed++;
  }

  return { synced, failed };
}
