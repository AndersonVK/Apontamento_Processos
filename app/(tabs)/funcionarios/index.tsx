import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEmployees } from '../../../hooks/useEmployees';
import { useAuth } from '../../../contexts/AuthContext';
import { Select } from '../../../components/ui/Select';
import { Employee } from '../../../types';
import { Colors } from '../../../constants/colors';

const WARN_BG = '#fffbeb';
const WARN_BORDER = '#f59e0b';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function FuncionariosScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const { profile } = useAuth();
  const { employees, loading, reload } = useEmployees(false, true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  // o aviso global leva para cá já filtrado em "Sem equipe"
  useEffect(() => {
    if (params.filter === 'sem_equipe') setFilter('none');
  }, [params.filter]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const canManage = profile?.role !== 'worker';

  const teams = useMemo(() => {
    const map = new Map<string, string>();
    employees.forEach((e) => e.team_id && e.team?.name && map.set(e.team_id, e.team.name));
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const isUnassigned = (e: Employee) => e.active && !e.team_id;
  const unassignedCount = employees.filter(isUnassigned).length;

  const filterOptions = [
    { label: `Todos (${employees.length})`, value: 'all' },
    { label: `Sem equipe (${unassignedCount})`, value: 'none' },
    { label: `Ativos (${employees.filter((e) => e.active).length})`, value: 'active' },
    { label: `Inativos (${employees.filter((e) => !e.active).length})`, value: 'inactive' },
    ...teams.map((t) => ({
      label: `Equipe: ${t.name} (${employees.filter((e) => e.team_id === t.id).length})`,
      value: `team:${t.id}`,
    })),
  ];

  const visible = employees
    .filter((e) => {
      if (filter === 'none') return isUnassigned(e);
      if (filter === 'active') return e.active;
      if (filter === 'inactive') return !e.active;
      if (filter.startsWith('team:')) return e.team_id === filter.slice(5);
      return true;
    })
    .filter((e) => norm(e.name).includes(norm(search)) || (e.registration ?? '').includes(search.trim()))
    // sem equipe primeiro, depois por nome; inativos por último
    .sort(
      (a, b) =>
        Number(!a.active) - Number(!b.active) ||
        Number(isUnassigned(b)) - Number(isUnassigned(a)) ||
        a.name.localeCompare(b.name)
    );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Funcionários</Text>
        {canManage && (
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/funcionarios/new')}>
            <Ionicons name="add" size={22} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterWrap}>
        <Select options={filterOptions} value={filter} onChange={setFilter} placeholder="Filtrar" />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color={Colors.gray400} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nome ou matrícula..."
          placeholderTextColor={Colors.gray400}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={Colors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={Colors.primary} />}
        ListHeaderComponent={<Text style={styles.count}>{visible.length} funcionário(s)</Text>}
        renderItem={({ item }) => {
          const unassigned = isUnassigned(item);
          return (
            <TouchableOpacity
              style={[styles.item, unassigned && styles.itemWarn, !item.active && styles.itemInactive]}
              onPress={() => canManage && router.push(`/funcionarios/${item.id}`)}
              activeOpacity={canManage ? 0.7 : 1}
            >
              <View style={[styles.avatar, unassigned && styles.avatarWarn]}>
                <Text style={[styles.avatarText, unassigned && { color: '#b45309' }]}>
                  {item.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.itemSub} numberOfLines={1}>
                  {item.registration ? `Mat. ${item.registration}` : 'Sem matrícula'}
                  {item.team?.name ? ` · ${item.team.name}` : ''}
                </Text>
              </View>
              {unassigned && (
                <View style={styles.warnChip}>
                  <Ionicons name="warning-outline" size={12} color="#92400e" />
                  <Text style={styles.warnChipText}>Sem equipe</Text>
                </View>
              )}
              {!item.active && (
                <View style={styles.inactiveChip}>
                  <Text style={styles.inactiveChipText}>Inativo</Text>
                </View>
              )}
              {canManage && <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhum funcionário encontrado</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: Colors.white,
  },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text },
  addBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  filterWrap: { paddingHorizontal: 12, paddingTop: 12 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 8,
    backgroundColor: Colors.white, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },
  list: { padding: 12, gap: 8, paddingBottom: 80 },
  count: { fontSize: 12, color: Colors.textSecondary, marginBottom: 2 },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.white,
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  itemWarn: { backgroundColor: WARN_BG, borderColor: WARN_BORDER, borderWidth: 1.5 },
  itemInactive: { opacity: 0.55 },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.primaryLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarWarn: { backgroundColor: '#fde68a' },
  avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 16 },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  itemSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  warnChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fde68a',
    paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6,
  },
  warnChipText: { fontSize: 11, fontWeight: '700', color: '#92400e' },
  inactiveChip: { backgroundColor: Colors.gray100, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6 },
  inactiveChipText: { fontSize: 11, fontWeight: '700', color: Colors.gray500 },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: Colors.gray400, fontSize: 14 },
});
