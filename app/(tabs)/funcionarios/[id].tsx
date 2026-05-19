import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../lib/supabase';
import { Employee, Team } from '../../../types';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { Colors } from '../../../constants/colors';

export default function EditFuncionarioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [name, setName] = useState('');
  const [registration, setRegistration] = useState('');
  const [teamId, setTeamId] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('employees').select('*').eq('id', id).single(),
      supabase.from('teams').select('*').order('name'),
    ]).then(([{ data: emp }, { data: tms }]) => {
      if (emp) {
        setEmployee(emp);
        setName(emp.name);
        setRegistration(emp.registration ?? '');
        setTeamId(emp.team_id ?? '');
      }
      setTeams(tms ?? []);
    });
  }, [id]);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('employees').update({
      name: name.trim(),
      registration: registration.trim() || null,
      team_id: teamId || null,
    }).eq('id', id);
    router.back();
    setSaving(false);
  }

  async function handleDeactivate() {
    Alert.alert('Desativar', `Desativar ${employee?.name}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desativar',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('employees').update({ active: false }).eq('id', id);
          router.back();
        },
      },
    ]);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Editar Funcionário</Text>

        <Input label="Nome completo" value={name} onChangeText={setName} required />
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

        <Button title="Salvar" onPress={handleSave} loading={saving} fullWidth size="lg" />
        <Button
          title="Desativar funcionário"
          onPress={handleDeactivate}
          variant="danger"
          fullWidth
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
