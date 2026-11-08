import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { Profile, Team, UserRole } from '../../../../types';
import { ROLE_LABELS } from '../../../../constants/roles';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { Button } from '../../../../components/ui/Button';
import { Colors } from '../../../../constants/colors';

export default function UsuarioEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile: me } = useAuth();
  const router = useRouter();
  const [target, setTarget] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('worker');
  const [teamId, setTeamId] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [p, t] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('teams').select('*').order('name'),
      ]);
      if (p.data) {
        setTarget(p.data as Profile);
        setName(p.data.name);
        setRole(p.data.role);
        setTeamId(p.data.team_id ?? '');
      }
      setTeams((t.data as Team[]) ?? []);
    })();
  }, [id]);

  if (!target || !me) return null;

  const isSelf = target.id === me.id;
  const iAmDirector = me.role === 'director';
  // Gerente não mexe em Diretor/Gerente (o banco também bloqueia)
  const locked = !iAmDirector && (target.role === 'director' || target.role === 'manager');
  const roleOptions = (iAmDirector
    ? (['director', 'manager', 'leader', 'worker'] as UserRole[])
    : (['leader', 'worker'] as UserRole[])
  ).map((r) => ({ label: ROLE_LABELS[r], value: r }));

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    const { error, data } = await supabase
      .from('profiles')
      .update({ name: name.trim(), role, team_id: teamId || null })
      .eq('id', id)
      .select('id');
    setSaving(false);
    if (error || !data?.length) {
      Alert.alert('Erro', error?.message ?? 'Sem permissão para alterar este usuário.');
      return;
    }
    router.back();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Editar usuário</Text>
      {locked && <Text style={styles.warn}>Apenas o Diretor pode alterar este usuário.</Text>}
      <Input label="Nome" value={name} onChangeText={setName} required editable={!locked} />
      <Select
        label="Perfil"
        options={roleOptions}
        value={role}
        onChange={(v) => setRole(v as UserRole)}
      />
      {isSelf && (
        <Text style={styles.hint}>
          Cuidado: se você rebaixar o seu próprio perfil, perde o acesso a esta tela.
        </Text>
      )}
      <Select
        label="Equipe"
        placeholder="Sem equipe"
        options={[{ label: 'Sem equipe', value: '' }, ...teams.map((t) => ({ label: t.name, value: t.id }))]}
        value={teamId}
        onChange={setTeamId}
      />
      <Text style={styles.hint}>
        A mudança vale no próximo login da pessoa. Para o líder aparecer como líder da equipe, use Configurações → Equipes.
      </Text>
      <Button title="Salvar" onPress={handleSave} loading={saving} disabled={locked} fullWidth size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  warn: { fontSize: 13, color: Colors.danger },
  hint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
