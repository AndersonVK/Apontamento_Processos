import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { addDaysIso } from '../lib/date';

/**
 * Primeiro dia em que uma mudança pode valer: o dia seguinte ao último dia FECHADO
 * entre as equipes envolvidas (o passado fechado não é reescrito). undefined = sem limite.
 */
export function useChangeMinDate(teamIds: (string | null | undefined)[]): string | undefined {
  const [min, setMin] = useState<string | undefined>(undefined);
  const key = teamIds.filter(Boolean).sort().join(',');

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) {
      setMin(undefined);
      return;
    }
    let cancelled = false;
    Promise.all(ids.map((id) => supabase.rpc('team_last_closed', { p_team: id }))).then((res) => {
      if (cancelled) return;
      const closed = res.map((r) => (r.error ? null : (r.data as string | null))).filter(Boolean) as string[];
      setMin(closed.length ? addDaysIso(closed.sort().slice(-1)[0], 1) : undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return min;
}
