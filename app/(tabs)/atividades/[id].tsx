import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { Activity, ActivityField, FieldType } from '../../../types';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Colors } from '../../../constants/colors';

export default function EditAtividadeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase
      .from('activities')
      .select(`*, fields:activity_fields(*, options:activity_field_options(*))`)
      .eq('id', id)
      .single();
    if (data) {
      setActivity(data as Activity);
      setName(data.name);
    }
  }

  useFocusEffect(useCallback(() => { load(); }, [id]));

  async function handleSaveName() {
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from('activities').update({ name: name.trim() }).eq('id', id);
    setSaving(false);
  }

  async function handleDeactivate() {
    Alert.alert('Desativar', `Desativar atividade "${activity?.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desativar',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('activities').update({ active: false }).eq('id', id);
          router.back();
        },
      },
    ]);
  }

  if (!activity) return null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Editar Atividade</Text>

        <Input label="Nome" value={name} onChangeText={setName} required />
        <Button title="Salvar nome" onPress={handleSaveName} loading={saving} />

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Campos extras</Text>

        {(activity.fields ?? []).map((field) => (
          <FieldRow key={field.id} field={field} onDelete={load} />
        ))}

        <TouchableOpacity
          style={styles.addFieldBtn}
          onPress={() =>
            router.push({
              pathname: '/atividades/field/new',
              params: { activityId: id },
            })
          }
        >
          <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
          <Text style={styles.addFieldText}>Adicionar campo</Text>
        </TouchableOpacity>

        <View style={styles.divider} />
        <Button title="Desativar atividade" onPress={handleDeactivate} variant="danger" fullWidth />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldRow({ field, onDelete }: { field: ActivityField; onDelete: () => void }) {
  async function del() {
    Alert.alert('Remover', `Remover campo "${field.name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('activity_fields').delete().eq('id', field.id);
          if (error) {
            Alert.alert(
              'Não foi possível remover',
              'Este campo já foi usado em apontamentos. Para preservar o histórico, ele não pode ser removido.'
            );
            return;
          }
          onDelete();
        },
      },
    ]);
  }

  return (
    <Card style={styles.fieldCard}>
      <View style={styles.fieldRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldName}>{field.name}</Text>
          <Text style={styles.fieldMeta}>
            {field.field_type === 'number' ? `Número${field.unit ? ` (${field.unit})` : ''}` : 'Seleção'}
            {field.required ? ' · Obrigatório' : ''}
          </Text>
          {field.field_type === 'select' && (field.options ?? []).length > 0 && (
            <Text style={styles.fieldOptions}>
              {field.options!.map((o) => o.label).join(', ')}
            </Text>
          )}
        </View>
        <TouchableOpacity onPress={del}>
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  screenTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  fieldCard: { padding: 12 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  fieldName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  fieldMeta: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  fieldOptions: { fontSize: 12, color: Colors.gray500, marginTop: 2 },
  addFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderRadius: 10,
    borderStyle: 'dashed',
  },
  addFieldText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
});
