import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { FieldType } from '../../../types';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { Colors } from '../../../constants/colors';

interface DraftField {
  localId: string;
  name: string;
  field_type: FieldType;
  unit: string;
  required: boolean;
  options: string[];
}

function makeField(): DraftField {
  return {
    localId: Math.random().toString(36).slice(2),
    name: '',
    field_type: 'number',
    unit: '',
    required: false,
    options: [''],
  };
}

export default function NewAtividadeScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [fields, setFields] = useState<DraftField[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  function updateField(localId: string, patch: Partial<DraftField>) {
    setFields((fs) => fs.map((f) => (f.localId === localId ? { ...f, ...patch } : f)));
  }

  function addOption(localId: string) {
    setFields((fs) =>
      fs.map((f) =>
        f.localId === localId ? { ...f, options: [...f.options, ''] } : f
      )
    );
  }

  function updateOption(localId: string, index: number, value: string) {
    setFields((fs) =>
      fs.map((f) => {
        if (f.localId !== localId) return f;
        const opts = [...f.options];
        opts[index] = value;
        return { ...f, options: opts };
      })
    );
  }

  function removeOption(localId: string, index: number) {
    setFields((fs) =>
      fs.map((f) =>
        f.localId === localId
          ? { ...f, options: f.options.filter((_, i) => i !== index) }
          : f
      )
    );
  }

  async function handleSave() {
    if (!name.trim()) { setNameError('Nome obrigatório'); return; }
    setSaving(true);

    const { data: activity, error } = await supabase
      .from('activities')
      .insert({ name: name.trim() })
      .select('id')
      .single();

    if (error) { Alert.alert('Erro', error.message); setSaving(false); return; }

    for (let i = 0; i < fields.length; i++) {
      const f = fields[i];
      if (!f.name.trim()) continue;

      const { data: fieldRow, error: fErr } = await supabase
        .from('activity_fields')
        .insert({
          activity_id: activity.id,
          name: f.name.trim(),
          field_type: f.field_type,
          unit: f.unit.trim() || null,
          required: f.required,
          sort_order: i,
        })
        .select('id')
        .single();

      if (fErr || !fieldRow) continue;

      if (f.field_type === 'select') {
        const opts = f.options
          .filter((o) => o.trim())
          .map((o, idx) => ({
            field_id: fieldRow.id,
            label: o.trim(),
            value: o.trim().toLowerCase().replace(/\s+/g, '_'),
            sort_order: idx,
          }));
        if (opts.length) await supabase.from('activity_field_options').insert(opts);
      }
    }

    router.back();
    setSaving(false);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.screenTitle}>Nova Atividade</Text>

        <Input
          label="Nome da atividade"
          value={name}
          onChangeText={(v) => { setName(v); setNameError(''); }}
          placeholder="Ex: Colheita, Desfolha, Irrigação..."
          error={nameError}
          required
        />

        <View style={styles.fieldsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Campos extras</Text>
            <TouchableOpacity
              style={styles.addFieldBtn}
              onPress={() => setFields((fs) => [...fs, makeField()])}
            >
              <Ionicons name="add" size={16} color={Colors.primary} />
              <Text style={styles.addFieldText}>Adicionar campo</Text>
            </TouchableOpacity>
          </View>

          {fields.map((field, idx) => (
            <Card key={field.localId} style={styles.fieldCard}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldNum}>Campo {idx + 1}</Text>
                <TouchableOpacity onPress={() => setFields((fs) => fs.filter((f) => f.localId !== field.localId))}>
                  <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                </TouchableOpacity>
              </View>

              <Input
                label="Nome"
                value={field.name}
                onChangeText={(v) => updateField(field.localId, { name: v })}
                placeholder="Ex: Quantidade, Qualidade..."
              />

              <Select
                label="Tipo"
                options={[
                  { label: 'Número', value: 'number' },
                  { label: 'Seleção', value: 'select' },
                ]}
                value={field.field_type}
                onChange={(v) => updateField(field.localId, { field_type: v as FieldType })}
              />

              {field.field_type === 'number' && (
                <Input
                  label="Unidade (opcional)"
                  value={field.unit}
                  onChangeText={(v) => updateField(field.localId, { unit: v })}
                  placeholder="Ex: caixas, kg, metros..."
                />
              )}

              {field.field_type === 'select' && (
                <View style={styles.optionsSection}>
                  <Text style={styles.optionsLabel}>Opções</Text>
                  {field.options.map((opt, oi) => (
                    <View key={oi} style={styles.optionRow}>
                      <Input
                        value={opt}
                        onChangeText={(v) => updateOption(field.localId, oi, v)}
                        placeholder={`Opção ${oi + 1}`}
                        containerStyle={{ flex: 1 }}
                      />
                      {field.options.length > 1 && (
                        <TouchableOpacity
                          style={styles.removeOptBtn}
                          onPress={() => removeOption(field.localId, oi)}
                        >
                          <Ionicons name="close" size={16} color={Colors.gray400} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addOptBtn}
                    onPress={() => addOption(field.localId)}
                  >
                    <Ionicons name="add" size={14} color={Colors.primary} />
                    <Text style={styles.addOptText}>Opção</Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                style={styles.requiredRow}
                onPress={() => updateField(field.localId, { required: !field.required })}
              >
                <View style={[styles.checkbox, field.required && styles.checkboxActive]}>
                  {field.required && <Ionicons name="checkmark" size={12} color={Colors.white} />}
                </View>
                <Text style={styles.requiredText}>Campo obrigatório</Text>
              </TouchableOpacity>
            </Card>
          ))}

          {fields.length === 0 && (
            <Text style={styles.noFields}>
              Sem campos extras. Esta atividade só terá funcionário, horário e observação.
            </Text>
          )}
        </View>

        <Button
          title="Salvar atividade"
          onPress={handleSave}
          loading={saving}
          fullWidth
          size="lg"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  screenTitle: { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  fieldsSection: { gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  addFieldBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addFieldText: { color: Colors.primary, fontWeight: '600', fontSize: 14 },
  fieldCard: { gap: 12 },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldNum: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  optionsSection: { gap: 8 },
  optionsLabel: { fontSize: 13, fontWeight: '500', color: Colors.gray700 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeOptBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.gray100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.primaryLight,
  },
  addOptText: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  requiredRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.gray300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  requiredText: { fontSize: 14, color: Colors.text },
  noFields: { fontSize: 13, color: Colors.textSecondary, textAlign: 'center', paddingVertical: 16 },
});
