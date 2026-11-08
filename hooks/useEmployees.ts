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
    setLoading(true);
    setError(null);
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
      // sem internet: usa a última lista guardada no aparelho
      const cached = await cacheGet<Employee[]>(cacheKey);
      if (cached) setEmployees(cached);
      else setError(e?.message ?? 'Erro ao carregar funcionários');
    }
    setLoading(false);
  }, [teamOnly, profile?.team_id, cacheKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { employees, loading, error, reload: load };
}
