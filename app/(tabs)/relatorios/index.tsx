import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { daysAgoIso } from '../../../lib/date';

interface DailySummary {
  activity_name: string;
  count: number;
  employee_count: number;
}

interface EmployeeSummary {
  employee_name: string;
  activity_name: string;
  total_entries: number;
}

function getDateRange(days: number): { start: string; end: string } {
  const end = daysAgoIso(0);
  const start = daysAgoIso(days - 1);
  return { start, end };
}

export default function RelatoriosScreen() {
  const [period, setPeriod] = useState<7 | 14 | 30>(7);
  const [loading, setLoading] = useState(false);
  const [dailySummary, setDailySummary] = useState<DailySummary[]>([]);
  const [employeeSummary, setEmployeeSummary] = useState<EmployeeSummary[]>([]);
  const [totalApontamentos, setTotalApontamentos] = useState(0);

  async function load() {
    setLoading(true);
    const { start, end } = getDateRange(period);

    const { data, error } = await supabase
      .from('apontamentos')
      .select(`
        id,
        work_date,
        employee:employees(name),
        activity:activities(name),
        field_values:apontamento_field_values(value, field:activity_fields(name, unit))
      `)
      .gte('work_date', start)
      .lte('work_date', end);

    if (error || !data) { setLoading(false); return; }

    setTotalApontamentos(data.length);

    // Daily summary by activity
    const actMap: Record<string, { count: number; employees: Set<string> }> = {};
    const empActMap: Record<string, number> = {};

    for (const ap of data as any[]) {
      const act = ap.activity?.name ?? 'Desconhecida';
      if (!actMap[act]) actMap[act] = { count: 0, employees: new Set() };
      actMap[act].count++;
      actMap[act].employees.add(ap.employee?.name ?? '');

      const key = `${ap.employee?.name}__${act}`;
      empActMap[key] = (empActMap[key] ?? 0) + 1;
    }

    setDailySummary(
      Object.entries(actMap).map(([activity_name, v]) => ({
        activity_name,
        count: v.count,
        employee_count: v.employees.size,
      }))
    );

    setEmployeeSummary(
      Object.entries(empActMap).map(([key, total_entries]) => {
        const [employee_name, activity_name] = key.split('__');
        return { employee_name, activity_name, total_entries };
      }).sort((a, b) => b.total_entries - a.total_entries).slice(0, 10)
    );

    setLoading(false);
  }

  useEffect(() => { load(); }, [period]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Relatórios</Text>
        <TouchableOpacity onPress={() => Alert.alert('Em breve', 'Export para Excel/PDF em desenvolvimento.')}>
          <Ionicons name="download-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={Colors.primary} />}
      >
        {/* Period selector */}
        <View style={styles.periodRow}>
          {([7, 14, 30] as const).map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.periodBtn, period === d && styles.periodBtnActive]}
              onPress={() => setPeriod(d)}
            >
              <Text style={[styles.periodText, period === d && styles.periodTextActive]}>
                {d} dias
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary card */}
        <Card>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalApontamentos}</Text>
              <Text style={styles.summaryLabel}>Apontamentos</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{dailySummary.length}</Text>
              <Text style={styles.summaryLabel}>Atividades</Text>
            </View>
          </View>
        </Card>

        {/* By activity */}
        <Text style={styles.sectionTitle}>Por atividade</Text>
        {dailySummary.map((item) => (
          <Card key={item.activity_name} style={styles.actCard}>
            <Text style={styles.actName}>{item.activity_name}</Text>
            <View style={styles.actStats}>
              <View style={styles.actStat}>
                <Text style={styles.actStatValue}>{item.count}</Text>
                <Text style={styles.actStatLabel}>Registros</Text>
              </View>
              <View style={styles.actStat}>
                <Text style={styles.actStatValue}>{item.employee_count}</Text>
                <Text style={styles.actStatLabel}>Funcionários</Text>
              </View>
            </View>
          </Card>
        ))}

        {/* Top employees */}
        <Text style={styles.sectionTitle}>Top funcionários</Text>
        {employeeSummary.map((item, i) => (
          <View key={i} style={styles.empRow}>
            <View style={styles.empRank}>
              <Text style={styles.empRankText}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.empName}>{item.employee_name}</Text>
              <Text style={styles.empActivity}>{item.activity_name}</Text>
            </View>
            <Text style={styles.empCount}>{item.total_entries}x</Text>
          </View>
        ))}
      </ScrollView>
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
  content: { padding: 16, gap: 12, paddingBottom: 80 },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
  },
  periodBtnActive: { backgroundColor: Colors.primary },
  periodText: { fontSize: 13, color: Colors.gray600, fontWeight: '500' },
  periodTextActive: { color: Colors.white, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center' },
  summaryValue: { fontSize: 32, fontWeight: '700', color: Colors.primary },
  summaryLabel: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  actCard: { padding: 12 },
  actName: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  actStats: { flexDirection: 'row', gap: 24 },
  actStat: { alignItems: 'center' },
  actStatValue: { fontSize: 22, fontWeight: '700', color: Colors.primary },
  actStatLabel: { fontSize: 11, color: Colors.textSecondary },
  empRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.white,
    borderRadius: 10,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  empRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empRankText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  empName: { fontSize: 14, fontWeight: '600', color: Colors.text },
  empActivity: { fontSize: 12, color: Colors.textSecondary },
  empCount: { fontSize: 14, fontWeight: '700', color: Colors.primary },
});
