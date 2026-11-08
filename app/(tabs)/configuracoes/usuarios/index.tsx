import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../../lib/supabase';
import { Profile, Team } from '../../../../types';
import { ROLE_LABELS } from '../../../../constants/roles';
import { Colors } from '../../../../constants/colors';

export default function UsuariosScreen() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [p, t] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('teams').select('*'),
    ]);
    if (p.error) setError(p.error.message);
    setProfiles((p.data as Profile[]) ?? []);
    setTeams((t.data as Team[]) ?? []);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  const teamName = (id: string | null) => teams.find((t) => t.id === id)?.name;

  return (
    <View style={styles.container}>
      <FlatList
        data={profiles}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <View style={styles.note}>
            <Ionicons name="information-circle-outline" size={18} color={Colors.primaryDark} />
            <Text style={styles.noteText}>
              Para criar um novo login: Supabase → Authentication → Users → Add user (marque "Auto confirm user").
              Ele aparece aqui como Operário, e você define o perfil e a equipe.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.item} onPress={() => router.push(`/configuracoes/usuarios/${item.id}`)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {ROLE_LABELS[item.role]}
                {teamName(item.team_id) ? ` · ${teamName(item.team_id)}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>{error || 'Nenhum usuário encontrado.'}</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 12, gap: 8, paddingBottom: 80 },
  note: {
    flexDirection: 'row', gap: 8, backgroundColor: Colors.primaryLight, borderRadius: 10,
    padding: 12, marginBottom: 4,
  },
  noteText: { flex: 1, fontSize: 12, color: Colors.primaryDark, lineHeight: 18 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white,
    borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 16 },
  name: { fontSize: 15, fontWeight: '600', color: Colors.text },
  meta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  empty: { textAlign: 'center', color: Colors.gray400, paddingTop: 40, fontSize: 14 },
});
