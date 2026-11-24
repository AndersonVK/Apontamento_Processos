import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useProjects } from '../../../../hooks/useProjects';
import { Colors } from '../../../../constants/colors';

export default function ProjetosScreen() {
  const router = useRouter();
  const { projects, loading, error, reload } = useProjects(true);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const sorted = [...projects].sort(
    (a, b) => Number(!a.active) - Number(!b.active) || a.name.localeCompare(b.name)
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={Colors.primary} />}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/configuracoes/projetos/new')}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
            <Text style={styles.addText}>Novo projeto</Text>
          </TouchableOpacity>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.active && styles.inactive]}
            onPress={() => router.push(`/configuracoes/projetos/${item.id}`)}
          >
            <View style={styles.icon}>
              <Ionicons name="folder-open-outline" size={18} color={Colors.primary} />
            </View>
            <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
            {!item.active && (
              <View style={styles.chip}>
                <Text style={styles.chipText}>Inativo</Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>{error || 'Nenhum projeto cadastrado.'}</Text> : null
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
  inactive: { opacity: 0.55 },
  icon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  chip: { backgroundColor: Colors.gray100, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
  chipText: { fontSize: 11, fontWeight: '700', color: Colors.gray500 },
  empty: { textAlign: 'center', color: Colors.gray400, paddingTop: 40, fontSize: 14 },
});
