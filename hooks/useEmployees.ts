import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Employee } from '../types';
import { useAuth } from '../contexts/AuthContext';

export function useEmployees(teamOnly = false) {
  const { profile } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    let query = supabase
      .from('employees')
      .select('*, team:teams(id, name)')
      .eq('active', true)
      .order('name');

    if (teamOnly && profile?.team_id) {
      query = query.eq('team_id', profile.team_id);
    }

    const { data, error } = await query;
    if (error) setError(error.message);
    else setEmployees(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [profile?.team_id]);

  return { employees, loading, error, reload: load };
}
