import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { Apontamento } from '../../../types';
import { useAuth } from '../../../contexts/AuthContext';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Colors } from '../../../constants/colors';

export default function ApontamentoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const [apontamento, setApontamento] = useState<Apontamento | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data } = await supabase
      .from('apontamentos')
      .select(`
        *,
        employee:employees(id, name),
        activity:activities(id, name),
        leader:profiles!leader_id(id, name),
        field_values:apontamento_field_values(
          *,
          field:activity_fields(id, name, field_type, unit)
        )
      `)
      .eq('id', id)
      .single();
    setApontamento(data as Apontamento);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function handleDelete() {
    Alert.alert('Excluir', 'Deseja excluir este apontamento?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('apontamentos').delete().eq('id', id);
          router.back();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (!apontamento) {
    return (
      <View style={styles.center}>
        <Text>Apontamento não encontrado</Text>
      </View>
    );
  }

  const canDelete =
    profile?.role === 'director' ||
    profile?.role === 'manager' ||
    (profile?.role === 'leader' && apontamento.leader_id === profile?.id);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Card>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {apontamento.employee?.name.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.name}>{apontamento.employee?.name}</Text>
            <Text style={styles.activity}>{apontamento.activity?.name}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.infoGrid}>
          <InfoItem icon="calendar-outline" label="Data" value={formatDate(apontamento.work_date)} />
          <InfoItem icon="time-outline" label="Horário" value={`${apontamento.start_time} – ${apontamento.end_time}`} />
          <InfoItem icon="person-outline" label="Líder" value={apontamento.leader?.name ?? '—'} />
        </View>

        {(apontamento.field_values?.length ?? 0) > 0 && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Dados da Atividade</Text>
            <View style={styles.fieldGrid}>
              {apontamento.field_values?.map((fv) => (
                <View key={fv.field_id} style={styles.fieldItem}>
                  <Text style={styles.fieldLabel}>{fv.field?.name}</Text>
                  <Text style={styles.fieldValue}>
                    {fv.value}
                    {fv.field?.unit ? ` ${fv.field.unit}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {apontamento.notes && (
          <>
            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Observações</Text>
            <Text style={styles.notes}>{apontamento.notes}</Text>
          </>
        )}
      </Card>

      {canDelete && (
        <Button
          title="Excluir apontamento"
          onPress={handleDelete}
          variant="danger"
          fullWidth
          style={{ marginTop: 8 }}
        />
      )}
    </ScrollView>
  );
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Ionicons name={icon as any} size={16} color={Colors.gray500} />
      <View>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 20 },
  name: { fontSize: 18, fontWeight: '700', color: Colors.text },
  activity: { fontSize: 14, color: Colors.textSecondary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginVertical: 12 },
  infoGrid: { gap: 12 },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoLabel: { fontSize: 11, color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontWeight: '600', color: Colors.text },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  fieldGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  fieldItem: { backgroundColor: Colors.gray50, borderRadius: 8, padding: 10, minWidth: 100 },
  fieldLabel: { fontSize: 11, color: Colors.textSecondary, marginBottom: 2 },
  fieldValue: { fontSize: 16, fontWeight: '700', color: Colors.primary },
  notes: { fontSize: 14, color: Colors.text, lineHeight: 20 },
});
