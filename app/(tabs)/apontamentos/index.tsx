import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApontamentos } from '../../../hooks/useApontamentos';
import { useAuth } from '../../../contexts/AuthContext';
import { ApontamentoCard } from '../../../components/apontamento/ApontamentoCard';
import { Colors } from '../../../constants/colors';

const DAYS = 7;

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function labelDate(iso: string): string {
  const today = formatDate(new Date());
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (iso === today) return 'Hoje';
  if (iso === yesterday) return 'Ontem';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function ApontamentosScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const { apontamentos, loading, reload } = useApontamentos(selectedDate);

  const dates = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(Date.now() - i * 86400000);
    return formatDate(d);
  });

  const canAdd = profile?.role === 'leader' || profile?.role === 'manager' || profile?.role === 'director';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Olá, {profile?.name?.split(' ')[0]} 👋
          </Text>
          <Text style={styles.subtitle}>
            {apontamentos.length} apontamento{apontamentos.length !== 1 ? 's' : ''}
          </Text>
        </View>
        {canAdd && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push('/apontamentos/new')}
          >
            <Ionicons name="add" size={26} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      {/* Date tabs */}
      <View style={styles.dateTabs}>
        {dates.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.dateTab, d === selectedDate && styles.dateTabActive]}
            onPress={() => setSelectedDate(d)}
          >
            <Text style={[styles.dateTabText, d === selectedDate && styles.dateTabTextActive]}>
              {labelDate(d)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={apontamentos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={Colors.primary} />
        }
        renderItem={({ item }) => (
          <ApontamentoCard
            apontamento={item}
            onPress={() => router.push(`/apontamentos/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="clipboard-outline" size={48} color={Colors.gray300} />
              <Text style={styles.emptyText}>Nenhum apontamento</Text>
              <Text style={styles.emptySubtext}>
                {canAdd ? 'Toque no + para adicionar' : 'Sem registros para esta data'}
              </Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: Colors.white,
  },
  greeting: { fontSize: 20, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 4,
  },
  dateTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  dateTabActive: { backgroundColor: Colors.primary },
  dateTabText: { fontSize: 13, color: Colors.gray500, fontWeight: '500' },
  dateTabTextActive: { color: Colors.white, fontWeight: '700' },
  list: { padding: 12, gap: 8, paddingBottom: 80 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.gray400 },
  emptySubtext: { fontSize: 13, color: Colors.gray400 },
});
