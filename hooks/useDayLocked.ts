import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { onQueueChange } from '../lib/events';

export const LOCKED_MESSAGE =
  'Este dia está fechado. Só um gerente ou diretor pode alterar ou reabrir.';

/**
 * O dia está travado para o usuário atual? Só líderes são travados (quando o dia
 * da equipe deles foi fechado). O banco também recusa; isto dá o aviso na tela.
 */
export function useDayLocked(date: string | undefined): boolean {
  const { profile } = useAuth();
  const [locked, setLocked] = useState(false);

  const load = useCallback(async () => {
    if (!date || profile?.role !== 'leader' || !profile.team_id) {
      setLocked(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('team_days')
        .select('closed_at')
        .eq('team_id', profile.team_id)
        .eq('work_date', date)
        .maybeSingle();
      if (error) throw error;
      setLocked(!!data?.closed_at);
    } catch {
      // sem internet: não bloqueia na tela (o banco decide ao enviar)
    }
  }, [date, profile?.id, profile?.role, profile?.team_id]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => onQueueChange(() => { load(); }), [load]);

  return locked;
}
