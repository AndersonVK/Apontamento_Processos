import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../../lib/supabase';
import { FieldType } from '../../../../types';
import { Input } from '../../../../components/ui/Input';
import { Select } from '../../../../components/ui/Select';
import { Button } from '../../../../components/ui/Button';
import { Colors } from '../../../../constants/colors';

export default function NewFieldScreen() {
  const { activityId } = useLocalSearchParams<{ activityId: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [type, setType] = useState<FieldType>('number');
  const [unit, setUnit] = useState('');
  const [required, setRequired] = useState(false);
  const [options, setOptions] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; options?: string }>({});

  async function handleSave() {
    const errs: typeof errors = {};
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!name.trim()) errs.name = 'Nome obrigatório';
    if (type === 'select' && cleanOptions.length < 2) errs.options = 'Informe ao menos 2 opções';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      // vai para o fim da lista de campos da atividade
      const { data: existing } = await supabase
        .from('activity_fields')
        .select('sort_order')
        .eq('activity_id', activityId)
        .order('sort_order', { ascending: false })
        .limit(1);
      const nextOrder = existing && existing.length ? existing[0].sort_order + 1 : 0;

      const { data: field, error } = await supabase
        .from('activity_fields')
        .insert({
          activity_id: activityId,
          name: name.trim(),
          field_type: type,
          unit: type === 'number' ? unit.trim() || null : null,
          required,
          sort_order: nextOrder,
        })
        .select('id')
        .single();
      if (error) throw error;

      if (type === 'select') {
        const { error: optErr } = await supabase.from('activity_field_options').insert(
          cleanOptions.map((label, i) => ({
            field_id: field.id,
            label,
            value: label.toLowerCase().replace(/\s+/g, '_'),
            sort_order: i,
          }))
        );
        if (optErr) throw optErr;
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Erro', e?.message ?? 'Não foi possível salvar o campo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Novo campo</Text>
      <Input
        label="Nome"
        value={name}
        onChangeText={(v) => { setName(v); setErrors((e) => ({ ...e, name: undefined })); }}
        placeholder="Ex: Quantidade, Qualidade..."
        error={errors.name}
        required
      />
      <Select
        label="Tipo"
        options={[{ label: 'Número', value: 'number' }, { label: 'Seleção', value: 'select' }]}
        value={type}
        onChange={(v) => setType(v as FieldType)}
      />
      {type === 'number' && (
        <Input label="Unidade (opcional)" value={unit} onChangeText={setUnit} placeholder="Ex: caixas, kg, metros..." />
      )}
      {type === 'select' && (
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Opções</Text>
          {options.map((opt, i) => (
            <View key={i} style={styles.optRow}>
              <Input
                value={opt}
                onChangeText={(v) => { setOptions((o) => o.map((x, j) => (j === i ? v : x))); setErrors((e) => ({ ...e, options: undefined })); }}
                placeholder={`Opção ${i + 1}`}
                containerStyle={{ flex: 1 }}
              />
              {options.length > 1 && (
                <TouchableOpacity style={styles.removeBtn} onPress={() => setOptions((o) => o.filter((_, j) => j !== i))}>
                  <Ionicons name="close" size={16} color={Colors.gray400} />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity style={styles.addOpt} onPress={() => setOptions((o) => [...o, ''])}>
            <Ionicons name="add" size={14} color={Colors.primary} />
            <Text style={styles.addOptText}>Opção</Text>
          </TouchableOpacity>
          {errors.options && <Text style={styles.error}>{errors.options}</Text>}
        </View>
      )}
      <TouchableOpacity style={styles.reqRow} onPress={() => setRequired((r) => !r)}>
        <View style={[styles.checkbox, required && styles.checkboxOn]}>
          {required && <Ionicons name="checkmark" size={12} color={Colors.white} />}
        </View>
        <Text style={styles.reqText}>Campo obrigatório</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>Apontamentos já feitos não são alterados; o campo vale para os próximos.</Text>
      <Button title="Salvar campo" onPress={handleSave} loading={saving} fullWidth size="lg" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  label: { fontSize: 14, fontWeight: '500', color: Colors.gray700 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeBtn: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.gray100,
    alignItems: 'center', justifyContent: 'center',
  },
  addOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: Colors.primaryLight,
  },
  addOptText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  error: { fontSize: 12, color: Colors.danger },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: Colors.gray300,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  reqText: { fontSize: 14, color: Colors.text },
  hint: { fontSize: 12, color: Colors.textSecondary },
});
