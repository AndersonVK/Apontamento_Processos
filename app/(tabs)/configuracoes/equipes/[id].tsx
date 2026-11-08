import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { Profile } from '../../../../types';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { Button } from '../../../../components/ui/Button';
import { Colors } from '../../../../constants/colors';

export default function EquipeFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const [name, setName] = useState('');
  const [leaderId, setLeaderId] = useState('');
  const [previousLeaderId, setPreviousLeaderId] = useState('');
  const [candidates, setCandidates] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    (async () => {
      const { data: profs } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['leader', 'manager'])
        .order('name');
      setCandidates((profs as Profile[]) ?? []);
      if (!isNew) {
        const { data: t } = await supabase.from('teams').select('*').eq('id', id).single();
        if (t) {
          setName(t.name);
          setLeaderId(t.leader_id ?? '');
          setPreviousLeaderId(t.leader_id ?? '');
        }
      }
    })();
  }, [id, isNew]);

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Nome obrigatório');
      return;
    }
    setSaving(true);
    try {
      let teamId = isNew ? '' : (id as string);
      const payload = { name: name.trim(), leader_id: leaderId || null };

      if (isNew) {
        const { data, error } = await supabase.from('teams').insert(payload).select('id').single();
        if (error) throw error;
        teamId = data.id;
      } else {
        const { error } = await supabase.from('teams').update(payload).eq('id', teamId);
        if (error) throw error;
      }

      // o líder passa a pertencer à equipe (é o team_id do perfil que define "minha equipe")
      if (leaderId) {
        const { error } = await supabase.from('profiles').update({ team_id: teamId }).eq('id', leaderId);
        if (error) throw error;
      }
      // líder anterior deixa de apontar para esta equipe
      if (previousLeaderId && previousLeaderId !== leaderId) {
        await supabase.from('profiles').update({ team_id: null }).eq('id', previousLeaderId).eq('team_id', teamId);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar a equipe.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{isNew ? 'Nova equipe' : 'Editar equipe'}</Text>
      <Input
        label="Nome da equipe"
        value={name}
        onChangeText={(v) => { setName(v); setNameError(''); }}
        placeholder="Ex: Equipe Colheita A"
        error={nameError}
        required
      />
      <Select
        label="Líder"
        placeholder="Sem líder"
        options={[{ label: 'Sem líder', value: '' }, ...candidates.map((p) => ({ label: p.name, value: p.id }))]}
        value={leaderId}
        onChange={setLeaderId}
      />
      <Text style={styles.hint}>
        Só aparecem quem tem perfil Líder ou Gerente. Para alguém aparecer aqui, defina o perfil em Configurações → Usuários.
        Os funcionários entram na equipe pela tela Funcionários.
      </Text>
      <Button title="Salvar" onPress={handleSave} loading={saving} fullWidth size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  hint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
