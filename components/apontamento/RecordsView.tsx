import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApontamentos } from '../../hooks/useApontamentos';
import { ApontamentoCard } from './ApontamentoCard';
import { Colors } from '../../constants/colors';

interface Props {
  date: string;
  onPressRecord: (id: string) => void;
}

/** Lista corrida dos apontamentos do dia (visão por registro). */
export function RecordsView({ date, onPressRecord }: Props) {
  const { apontamentos, loading, reload } = useApontamentos(date);
  return (
    <FlatList
      data={apontamentos}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={Colors.primary} />}
      renderItem={({ item }) => (
        <ApontamentoCard apontamento={item} onPress={item.synced ? () => onPressRecord(item.id) : undefined} />
      )}
      ListEmptyComponent={
        !loading ? (
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={48} color={Colors.gray300} />
            <Text style={styles.emptyText}>Nenhum apontamento</Text>
          </View>
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 12, gap: 8, paddingBottom: 80 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyText: { fontSize: 16, fontWeight: '600', color: Colors.gray400 },
});
