import React from 'react';
import { Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUnassignedCount } from '../../hooks/useUnassignedCount';

/** Aviso fixo no topo de todas as telas quando há funcionário ativo sem equipe. */
export function UnassignedBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const count = useUnassignedCount();
  if (count === 0) return null;

  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.bar, { paddingTop: (Platform.OS === 'web' ? 0 : insets.top) + 8 }]}
      onPress={() => router.navigate({ pathname: '/funcionarios', params: { filter: 'sem_equipe' } })}
    >
      <Ionicons name="warning-outline" size={16} color="#92400e" />
      <Text style={styles.text}>
        {count} funcionário{count > 1 ? 's' : ''} sem equipe. Toque para ver
      </Text>
      <Ionicons name="chevron-forward" size={16} color="#92400e" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingBottom: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fde68a',
  },
  text: { fontSize: 13, fontWeight: '700', color: '#92400e' },
});
