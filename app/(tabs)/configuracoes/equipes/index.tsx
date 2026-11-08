import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../../lib/supabase';
import { Profile, Team } from '../../../../types';
import { Colors } from '../../../../constants/colors';

interface Row {
  team: Team;
  leaderName: string | null;
  members: number;
}

export default function EquipesScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [t, p, e] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('profiles').select('id, name'),
      supabase.from('employees').select('id, team_id').eq('active', true),
    ]);
    if (t.error) {
      setError(t.error.message);
      setLoading(false);
      return;
    }
    const names = new Map((p.data ?? []).map((x: Pick<Profile, 'id' | 'name'>) => [x.id, x.name]));
    const counts = new Map<string, number>();
    (e.data ?? []).forEach((x: any) => {
      if (x.team_id) counts.set(x.team_id, (counts.get(x.team_id) ?? 0) + 1);
    });
    setRows(
      ((t.data as Team[]) ?? []).map((team) => ({
        team,
        leaderName: team.leader_id ? names.get(team.leader_id) ?? null : null,
        members: counts.get(team.id) ?? 0,
      }))
    );
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.team.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/configuracoes/equipes/new')}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.addText}>Nova equipe</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => router.push(`/configuracoes/equipes/${item.team.id}`)}>
            <View style={styles.icon}>
              <Ionicons name="people-outline" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.team.name}</Text>
              <Text style={styles.meta}>
                Líder: {item.leaderName ?? 'não definido'} · {item.members} funcionário{item.members !== 1 ? 's' : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>{error || 'Nenhuma equipe cadastrada.'}</Text>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 12, gap: 8, paddingBottom: 80 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderWidth: 1.5, borderColor: Colors.primary, borderStyle: 'dashed',
    borderRadius: 10, marginBottom: 4,
  },
  addText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white,
    borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  icon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { fontSize: 15, fontWeight: '600', color: Colors.text },
  meta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  empty: { textAlign: 'center', color: Colors.gray400, paddingTop: 40, fontSize: 14 },
});
