import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Activity } from '../types';

export function useActivities() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
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

    if (error) setError(error.message);
    else setActivities(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return { activities, loading, error, reload: load };
}
