import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Project } from '../types';
import { cacheGet, cacheSet } from '../lib/cache';

/** Projetos para escolher no apontamento. Mostra a cópia guardada na hora (funciona offline). */
export function useProjects(includeInactive = false) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cacheKey = includeInactive ? 'projects:all' : 'projects:active';

  const load = useCallback(async () => {
    setError(null);
    const cached = await cacheGet<Project[]>(cacheKey);
    if (cached) {
      setProjects(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      let query = supabase.from('projects').select('*').order('name');
      if (!includeInactive) query = query.eq('active', true);
      const { data, error } = await query;
      if (error) throw error;
      setProjects((data as Project[]) ?? []);
      cacheSet(cacheKey, data ?? []);
    } catch (e: any) {
      if (!cached) setError(e?.message ?? 'Erro ao carregar projetos');
    }
    setLoading(false);
  }, [cacheKey, includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  return { projects, loading, error, reload: load };
}
