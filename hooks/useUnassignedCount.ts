import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cacheGet, cacheSet } from '../lib/cache';
import { onEmployeesChanged } from '../lib/events';

/** Quantos funcionários ATIVOS estão sem equipe (para o aviso global). */
export function useUnassignedCount() {
  const { profile } = useAuth();
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const load = useCallback(async () => {
    if (!profile || profile.role === 'worker') {
      setCount(0);
      return;
    }
    try {
      const { count: c, error } = await supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .eq('active', true)
        .is('team_id', null);
      if (error) throw error;
      setCount(c ?? 0);
      cacheSet('unassigned_count', c ?? 0);
    } catch {
      const cached = await cacheGet<number>('unassigned_count');
      if (cached !== null) setCount(cached);
    }
  }, [profile?.id, profile?.role]);

  // recalcula ao trocar de tela e quando um funcionário é salvo
  useEffect(() => {
    load();
  }, [load, pathname]);
  useEffect(() => onEmployeesChanged(() => { load(); }), [load]);

  return count;
}
