import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { cacheGet, cacheSet } from '../lib/cache';
import { monthRange } from '../lib/calendar';

export interface DayMark {
  has_records: boolean;
  closed: boolean;
  no_work: boolean;
}

/** Resumo de cada dia do mês de uma equipe (para os marcadores do calendário). */
export function useMonthOverview(teamId: string | null, year: number, monthIndex: number, enabled: boolean) {
  const [marks, setMarks] = useState<Record<string, DayMark>>({});
  const [loading, setLoading] = useState(false);
  const key = `month:${teamId}:${year}-${String(monthIndex + 1).padStart(2, '0')}`;

  const load = useCallback(async () => {
    if (!enabled || !teamId) {
      setMarks({});
      return;
    }
    const cached = await cacheGet<Record<string, DayMark>>(key);
    setMarks(cached ?? {});
    setLoading(true);
    try {
      const { from, to } = monthRange(year, monthIndex);
      const { data, error } = await supabase.rpc('team_month_days', { p_team: teamId, p_from: from, p_to: to });
      if (error) throw error;
      const map: Record<string, DayMark> = {};
      ((data as any[]) ?? []).forEach((r) => {
        map[r.work_date] = { has_records: r.has_records, closed: r.closed, no_work: r.no_work };
      });
      setMarks(map);
      cacheSet(key, map);
    } catch {
      // sem internet ou função indisponível: segue com o que está guardado
    }
    setLoading(false);
  }, [enabled, teamId, year, monthIndex, key]);

  useEffect(() => {
    load();
  }, [load]);

  return { marks, loading };
}
