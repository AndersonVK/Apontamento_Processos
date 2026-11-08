import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Employee } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { cacheGet, cacheSet } from '../lib/cache';

export function useEmployees(teamOnly = false) {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = `employees:${teamOnly ? profile?.team_id ?? 'none' : 'all'}`;

  const load = useCallback(async () => {
    setError(null);
    // mostra imediatamente o que está guardado no aparelho (funciona sem internet)
    const cached = await cacheGet<Employee[]>(cacheKey);
    if (cached) {
      setEmployees(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      let query = supabase
        .from('employees')
        .select('*, team:teams(id, name)')
        .eq('active', true)
        .order('name');

      if (teamOnly && profile?.team_id) {
        query = query.eq('team_id', profile.team_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setEmployees((data as Employee[]) ?? []);
      cacheSet(cacheKey, data ?? []);
    } catch (e: any) {
      // sem internet: segue com a lista guardada (se houver)
      if (!cached) setError(e?.message ?? 'Erro ao carregar funcionários');
    }
    setLoading(false);
  }, [teamOnly, profile?.team_id, cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { employees, loading, error, reload: load };
}
