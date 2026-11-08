import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Apontamento } from '../../types';
import { Card } from '../ui/Card';
import { Colors } from '../../constants/colors';
import { shortTime, formatDuration } from '../../lib/date';

interface ApontamentoCardProps {
  apontamento: Apontamento;
  onPress?: () => void;
}

export function ApontamentoCard({ apontamento, onPress }: ApontamentoCardProps) {
  const fieldValues = apontamento.field_values ?? [];

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Card>
        <View style={styles.header}>
          <View style={styles.nameRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {apontamento.employee?.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.employeeName}>{apontamento.employee?.name}</Text>
              <Text style={styles.activityName}>{apontamento.activity?.name}</Text>
            </View>
          </View>
          {!apontamento.synced && (
            <View style={styles.pendingBadge}>
              <Ionicons name="cloud-upload-outline" size={12} color={Colors.warning} />
              <Text style={styles.pendingText}>Pendente</Text>
            </View>
          )}
        </View>

        <View style={styles.timeRow}>
          <View style={styles.timeItem}>
            <Ionicons name="time-outline" size={14} color={Colors.gray500} />
            <Text style={styles.timeText}>
              {shortTime(apontamento.start_time)} – {shortTime(apontamento.end_time)}
              {formatDuration(apontamento.start_time, apontamento.end_time) ? `  (${formatDuration(apontamento.start_time, apontamento.end_time)})` : ''}
            </Text>
          </View>
        </View>

        {fieldValues.length > 0 && (
          <View style={styles.fields}>
            {fieldValues.map((fv) => (
              <View key={fv.field_id} style={styles.fieldItem}>
                <Text style={styles.fieldLabel}>{fv.field?.name}:</Text>
                <Text style={styles.fieldValue}>
                  {fv.value}
                  {fv.field?.field_type === 'number' && fv.field?.unit
                    ? ` ${fv.field.unit}`
                    : ''}
                </Text>
              </View>
            ))}
          </View>
        )}

        {apontamento.notes ? (
          <Text style={styles.notes}>{apontamento.notes}</Text>
        ) : null}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 16 },
  employeeName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  activityName: { fontSize: 13, color: Colors.textSecondary, marginTop: 1 },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.warningLight,
    borderRadius: 6,
  },
  pendingText: { fontSize: 11, color: Colors.warning, fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  timeItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontSize: 13, color: Colors.textSecondary },
  fields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.gray50,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  fieldLabel: { fontSize: 12, color: Colors.gray500 },
  fieldValue: { fontSize: 12, fontWeight: '600', color: Colors.text },
  notes: { fontSize: 13, color: Colors.textSecondary, marginTop: 6, fontStyle: 'italic' },
});
