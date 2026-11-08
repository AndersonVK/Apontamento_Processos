import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Activity } from '../types';
import { cacheGet, cacheSet } from '../lib/cache';

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const cached = await cacheGet<Activity[]>('activities');
    if (cached) {
      setActivities(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const { data, error } = await supabase
        .from('activities')
        .select(`
          *,
          fields:activity_fields(
            *,
            options:activity_field_options(*)
          )
        `)
        .eq('active', true)
        .order('name');
      if (error) throw error;

      // ordena campos e opções pela ordem configurada
      const sorted = ((data as Activity[]) ?? []).map((a) => ({
        ...a,
        fields: (a.fields ?? [])
          .slice()
          .sort((x, y) => x.sort_order - y.sort_order)
          .map((f) => ({
            ...f,
            options: (f.options ?? []).slice().sort((x, y) => x.sort_order - y.sort_order),
          })),
      }));
      setActivities(sorted);
      cacheSet('activities', sorted);
    } catch (e: any) {
      if (!cached) setError(e?.message ?? 'Erro ao carregar atividades');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { activities, loading, error, reload: load };
}
