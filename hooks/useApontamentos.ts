import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Apontamento } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function useApontamentos(date?: string) {
  const { profile } = useAuth();
  const [apontamentos, setApontamentos] = useState<Apontamento[]>([]);
  const [loading, setLoading] = useState(true);

  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  async function load() {
    if (!profile) return;
    setLoading(true);

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
    if (!error) setApontamentos((data as Apontamento[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [targetDate, profile?.id]);

  return { apontamentos, loading, reload: load };
}
