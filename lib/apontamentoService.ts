import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { saveOffline } from './offline';
import { notifyQueueChange, isNetworkError, syncPending } from './sync';
import { cacheSet } from './cache';
import { Activity, ApontamentoFormData, OfflineMeta } from '../types';

/** Dados de exibição guardados junto do registro (para listar sem internet). */
export function buildMeta(
  employeeName: string,
  activity: Activity | undefined,
  fieldValues: Record<string, string>
): OfflineMeta {
  return {
    employee_name: employeeName,
    activity_name: activity?.name ?? 'Atividade',
    fields: (activity?.fields ?? [])
      .filter((f) => (fieldValues[f.id] ?? '') !== '')
      .map((f) => {
        const raw = fieldValues[f.id];
        const value =
          f.field_type === 'select' ? f.options?.find((o) => o.value === raw)?.label ?? raw : raw;
        return { field_id: f.id, name: f.name, value, unit: f.unit, field_type: f.field_type };
      }),
  };
}

export function lastActivityKey(profileId: string) {
  return `last_activity:${profileId}`;
}

/**
 * Grava um apontamento: direto no servidor se houver rede; se não houver
 * (ou o servidor não responder), guarda na fila local para enviar depois.
 * Erros de regra do servidor (ex.: permissão) são lançados.
 */
export async function submitApontamento(
  form: ApontamentoFormData,
  leaderId: string,
  meta: OfflineMeta
): Promise<'online' | 'queued'> {
  async function saveLocally(): Promise<'queued'> {
    await saveOffline(form, leaderId, meta);
    notifyQueueChange();
    return 'queued';
  }

  cacheSet(lastActivityKey(leaderId), form.activity_id);

  const net = await NetInfo.fetch();
  if (net.isConnected === false) return saveLocally();

  try {
    const { data: ap, error } = await supabase
      .from('apontamentos')
      .insert({
        employee_id: form.employee_id,
        activity_id: form.activity_id,
        leader_id: leaderId,
        work_date: form.work_date,
        start_time: form.start_time,
        end_time: form.end_time,
        notes: form.notes || null,
      })
      .select('id')
      .single();
    if (error) throw error;

    const fieldEntries = Object.entries(form.field_values)
      .filter(([, v]) => v !== '')
      .map(([field_id, value]) => ({ apontamento_id: ap.id, field_id, value }));
    if (fieldEntries.length > 0) {
      const { error: fvErr } = await supabase.from('apontamento_field_values').insert(fieldEntries);
      if (fvErr) throw fvErr;
    }
    notifyQueueChange();
    syncPending().catch(() => {});
    return 'online';
  } catch (e: any) {
    if (isNetworkError(e)) return saveLocally();
    throw e;
  }
}
