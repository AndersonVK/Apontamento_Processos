import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Apontamento } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { daysAgoIso } from '../lib/date';
import { getPendingSync, OfflineApontamento } from '../lib/offline';
import { onQueueChange } from '../lib/sync';

function pendingToApontamento(p: OfflineApontamento): Apontamento {
  return {
    id: p.id,
    local_id: p.id,
    employee_id: p.employee_id,
    activity_id: p.activity_id,
    leader_id: p.leader_id,
    work_date: p.work_date,
    start_time: p.start_time,
    end_time: p.end_time,
    notes: p.notes,
    synced: false,
    created_at: p.created_at,
    updated_at: p.created_at,
    employee: { id: p.employee_id, name: p.meta?.employee_name ?? 'Funcionário' } as any,
    activity: { id: p.activity_id, name: p.meta?.activity_name ?? 'Atividade' } as any,
    field_values: (p.meta?.fields ?? []).map((f) => ({
      field_id: f.field_id,
      value: f.value,
      field: { id: f.field_id, name: f.name, unit: f.unit, field_type: f.field_type } as any,
    })),
  };
}

export function useApontamentos(date?: string) {
  const { profile } = useAuth();
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [loading, setLoading] = useState(true);

  const targetDate = date ?? daysAgoIso(0);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    // 1) registros ainda na fila local (salvos sem internet)
    let pending: Apontamento[] = [];
    try {
      pending = (await getPendingSync())
        .filter((p) => p.work_date === targetDate && p.leader_id === profile.id)
        .map(pendingToApontamento)
        .reverse();
    } catch {}

    // 2) registros do servidor (se estiver sem internet, segue só com os pendentes)
    let remote: Apontamento[] = [];
    try {
      let query = supabase
        .from('apontamentos')
        .select(`
          *,
          employee:employees(id, name),
          activity:activities(id, name),
          leader:profiles!leader_id(id, name),
          field_values:apontamento_field_values(
            *,
            field:activity_fields(id, name, field_type, unit)
          )
        `)
        .eq('work_date', targetDate)
        .order('created_at', { ascending: false });

      if (profile.role === 'leader') {
        query = query.eq('leader_id', profile.id);
      }

      const { data, error } = await query;
      if (!error) remote = ((data as Apontamento[]) ?? []).map((a) => ({ ...a, synced: true }));
    } catch {}

    // evita duplicar: um pendente recém sincronizado já pode estar no servidor
    const remoteLocalIds = new Set(remote.map((r) => r.local_id).filter(Boolean));
    setApontamentos([...pending.filter((p) => !remoteLocalIds.has(p.id)), ...remote]);
    setLoading(false);
  }, [targetDate, profile?.id, profile?.role]);

  useEffect(() => {
    load();
  }, [load]);

  // recarrega quando a fila offline muda (sincronizou ou salvou algo novo)
  useEffect(() => onQueueChange(() => { load(); }), [load]);

  return { apontamentos, loading, reload: load };
}
