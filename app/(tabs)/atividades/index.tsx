import React from 'react';
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
import { useActivities } from '../../../hooks/useActivities';
import { Colors } from '../../../constants/colors';

export default function AtividadesScreen() {
  const router = useRouter();
  const { activities, loading, reload } = useActivities();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Atividades</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/atividades/new')}
        >
          <Ionicons name="add" size={22} color={Colors.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={activities}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={reload} tintColor={Colors.primary} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.item}
            onPress={() => router.push(`/atividades/${item.id}`)}
          >
            <View style={styles.itemIcon}>
              <Ionicons name="leaf-outline" size={18} color={Colors.primary} />
            </View>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemFields}>
                {item.fields?.length
                  ? `${item.fields.length} campo${item.fields.length !== 1 ? 's' : ''} extra${item.fields.length !== 1 ? 's' : ''}`
                  : 'Sem campos extras'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.gray300} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Nenhuma atividade cadastrada</Text>
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
  title: { fontSize: 24, fontWeight: '700', color: Colors.text },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: { padding: 12, gap: 8, paddingBottom: 80 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  itemFields: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { color: Colors.gray400, fontSize: 14 },
});
