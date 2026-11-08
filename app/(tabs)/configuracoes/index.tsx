import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { Colors } from '../../../constants/colors';

const ROLE_LABELS: Record<string, string> = {
  director: 'Diretor',
  manager: 'Gerente',
  leader: 'Líder',
  worker: 'Operário',
};

export default function ConfiguracoesScreen() {
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const canManage = profile?.role === 'director' || profile?.role === 'manager';

  function handleSignOut() {
    Alert.alert('Sair', 'Deseja sair da conta?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Configurações</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {profile?.name?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.profileName}>{profile?.name}</Text>
            <Text style={styles.profileRole}>
              {ROLE_LABELS[profile?.role ?? ''] ?? profile?.role}
            </Text>
          </View>
        </View>

        {canManage && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gerenciar</Text>
            <TouchableOpacity style={styles.moduleItem} onPress={() => router.push('/configuracoes/equipes')}>
              <View style={styles.moduleIcon}>
                <Ionicons name="people-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={[styles.moduleName, { flex: 1 }]}>Equipes</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.moduleItem} onPress={() => router.push('/configuracoes/usuarios')}>
              <View style={styles.moduleIcon}>
                <Ionicons name="key-outline" size={20} color={Colors.primary} />
              </View>
              <Text style={[styles.moduleName, { flex: 1 }]}>Usuários e perfis</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
            </TouchableOpacity>
          </View>
        )}

        {/* Processos placeholder */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Módulos</Text>
          <View style={styles.moduleItem}>
            <View style={styles.moduleIcon}>
              <Ionicons name="clipboard-outline" size={20} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.moduleName}>Apontamentos</Text>
              <Text style={styles.moduleStatus}>Ativo</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Online</Text>
            </View>
          </View>
          <View style={[styles.moduleItem, styles.moduleItemDisabled]}>
            <View style={[styles.moduleIcon, styles.moduleIconDisabled]}>
              <Ionicons name="document-text-outline" size={20} color={Colors.gray400} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.moduleName, { color: Colors.gray400 }]}>Processos</Text>
              <Text style={styles.moduleStatus}>Em breve</Text>
            </View>
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>Em breve</Text>
            </View>
          </View>
        </View>

        <MenuItem
          icon="information-circle-outline"
          label="Versão"
          value="1.0.0"
          onPress={() => {}}
        />

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={Colors.danger} />
          <Text style={styles.signOutText}>Sair</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Ionicons name={icon as any} size={20} color={Colors.gray500} />
      <Text style={styles.menuLabel}>{label}</Text>
      {value && <Text style={styles.menuValue}>{value}</Text>}
      <Ionicons name="chevron-forward" size={16} color={Colors.gray300} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: Colors.white,
  },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text },
  content: { padding: 16, gap: 12, paddingBottom: 80 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { color: Colors.white, fontWeight: '700', fontSize: 22 },
  profileName: { fontSize: 17, fontWeight: '700', color: Colors.text },
  profileRole: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  section: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  moduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  moduleItemDisabled: { opacity: 0.6 },
  moduleIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moduleIconDisabled: { backgroundColor: Colors.gray100 },
  moduleName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  moduleStatus: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
  },
  activeBadgeText: { fontSize: 11, color: Colors.primary, fontWeight: '600' },
  soonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: Colors.gray100,
    borderRadius: 6,
  },
  soonBadgeText: { fontSize: 11, color: Colors.gray500, fontWeight: '600' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  menuLabel: { flex: 1, fontSize: 14, color: Colors.text },
  menuValue: { fontSize: 14, color: Colors.textSecondary },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Colors.dangerLight,
    marginTop: 8,
  },
  signOutText: { fontSize: 15, fontWeight: '600', color: Colors.danger },
});
