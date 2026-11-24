import React, { useEffect, useState } from 'react';
import { Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../../../lib/supabase';
import { Project } from '../../../../types';
import { Input } from '../../../../components/ui/Input';
import { Button } from '../../../../components/ui/Button';
import { showMessage, confirmAction } from '../../../../lib/dialog';
import { Colors } from '../../../../constants/colors';

export default function ProjetoFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    supabase.from('projects').select('*').eq('id', id).single().then(({ data }) => {
      if (data) {
        setProject(data as Project);
        setName(data.name);
      }
    });
  }, [id, isNew]);

  function explain(error: { code?: string; message: string }) {
    return error.code === '23505' ? 'Já existe um projeto com este nome.' : error.message;
  }

  async function handleSave() {
    if (!name.trim()) {
      setNameError('Informe o nome do projeto');
      return;
    }
    setSaving(true);
    const { error, data } = isNew
      ? await supabase.from('projects').insert({ name: name.trim() }).select('id')
      : await supabase.from('projects').update({ name: name.trim() }).eq('id', id).select('id');
    setSaving(false);
    if (error || !data?.length) {
      showMessage('Erro', error ? explain(error) : 'Sem permissão para alterar este projeto.');
      return;
    }
    router.back();
  }

  async function toggleActive() {
    if (!project) return;
    const next = !project.active;
    if (!next && !(await confirmAction('Desativar', `Desativar "${project.name}"? Ele deixa de aparecer para novos apontamentos; os já feitos continuam.`, 'Desativar', true))) return;
    const { error } = await supabase.from('projects').update({ active: next }).eq('id', id);
    if (error) {
      showMessage('Erro', explain(error));
      return;
    }
    router.back();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{isNew ? 'Novo projeto' : 'Editar projeto'}</Text>
      <Input
        label="Nome do projeto"
        value={name}
        onChangeText={(v) => { setName(v); setNameError(''); }}
        placeholder="Ex: Hidroponia"
        error={nameError}
        required
        onSubmitEditing={handleSave}
      />
      <Button title="Salvar" onPress={handleSave} loading={saving} fullWidth size="lg" />
      {!isNew && project && (
        <Button
          title={project.active ? 'Desativar projeto' : 'Reativar projeto'}
          onPress={toggleActive}
          variant={project.active ? 'danger' : 'secondary'}
          fullWidth
        />
      )}
      {!isNew && (
        <Text style={styles.hint}>
          Projetos já usados em apontamentos não podem ser apagados. Desative para tirar da lista de escolha.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  hint: { fontSize: 12, color: Colors.textSecondary, lineHeight: 18 },
});
