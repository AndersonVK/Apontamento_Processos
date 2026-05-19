import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Team } from '../../../types';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { Colors } from '../../../constants/colors';

export default function NewFuncionarioScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState('');
  const [teamId, setTeamId] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.from('teams').select('*').order('name').then(({ data }) => {
      setTeams(data ?? []);
    });
  }, []);

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Nome obrigatório';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    const { error } = await supabase.from('employees').insert({
      name: name.trim(),
      registration: registration.trim() || null,
      team_id: teamId || null,
    });

    if (error) Alert.alert('Erro', error.message);
    else router.back();
    setSaving(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Novo Funcionário</Text>

        <Input
          label="Nome completo"
          value={name}
          onChangeText={setName}
          placeholder="Ex: João da Silva"
          error={errors.name}
          required
        />
        <Input
          label="Matrícula"
          value={registration}
          onChangeText={setRegistration}
          placeholder="Opcional"
          keyboardType="numeric"
        />
        <Select
          label="Equipe"
          placeholder="Selecionar equipe..."
          options={teams.map((t) => ({ label: t.name, value: t.id }))}
          value={teamId}
          onChange={setTeamId}
        />

        <Button
          title="Cadastrar"
          onPress={handleSave}
          loading={saving}
          fullWidth
          size="lg"
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
});
