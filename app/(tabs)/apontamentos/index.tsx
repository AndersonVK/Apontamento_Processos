import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Pressable, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../contexts/AuthContext';
import { useRoster, useTeamsOverview, RosterRow, RosterRecord } from '../../../hooks/useRoster';
import { RosterRowCard } from '../../../components/apontamento/RosterRowCard';
import { RecordsView } from '../../../components/apontamento/RecordsView';
import { AbsenceSheet } from '../../../components/apontamento/AbsenceSheet';
import { IdleSheet } from '../../../components/apontamento/IdleSheet';
import { DaySheet } from '../../../components/apontamento/DaySheet';
import { Select } from '../../../components/ui/Select';
import { Interval, fmtMin } from '../../../lib/coverage';
import { daysAgoIso } from '../../../lib/date';
import { confirmAction, showMessage } from '../../../lib/dialog';
import * as day from '../../../lib/dayService';
import { removeOp, getOutbox } from '../../../lib/outbox';
import { Colors } from '../../../constants/colors';
import { HEADER_TOP_PADDING } from '../../../constants/layout';

const DAYS = 7;

function labelDate(iso: string): string {
  if (iso === daysAgoIso(0)) return 'Hoje';
  if (iso === daysAgoIso(1)) return 'Ontem';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

type Item = { type: 'row'; row: RosterRow } | { type: 'label'; text: string };

export default function ApontamentosScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const [date, setDate] = useState(daysAgoIso(0));
  const [mode, setMode] = useState<'equipe' | 'registros'>('equipe');
  const [teamPick, setTeamPick] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [absenceFor, setAbsenceFor] = useState<RosterRow | null>(null);
  const [idleFor, setIdleFor] = useState<{ row: RosterRow; gap?: Interval } | null>(null);
  const [daySheet, setDaySheet] = useState(false);

  const isManager = profile?.role === 'director' || profile?.role === 'manager';
  const canAdd = profile?.role === 'leader' || isManager;
  const overview = useTeamsOverview(date);
  const teamId = isManager ? teamPick || profile?.team_id || overview[0]?.id || null : profile?.team_id ?? null;
  const roster = useRoster(teamId, date);
  const { rows, summary, team, teamDay } = roster;

  useFocusEffect(useCallback(() => { roster.reload(); }, [roster.reload]));

  const dates = Array.from({ length: DAYS }, (_, i) => daysAgoIso(i));
  const members = rows.filter((r) => !r.borrowed);
  const borrowed = rows.filter((r) => r.borrowed);
  const items: Item[] = [
    ...members.map((row) => ({ type: 'row' as const, row })),
    ...(borrowed.length ? [{ type: 'label' as const, text: 'Emprestados para você' }] : []),
    ...borrowed.map((row) => ({ type: 'row' as const, row })),
  ];

  // ---- ações
  function openAdd(row: RosterRow, gap?: Interval) {
    const first = row.analysis.gaps[0];
    const g = gap ?? (row.status === 'partial' ? first : undefined);
    router.push({
      pathname: '/apontamentos/new',
      params: {
        employee_id: row.employee.id,
        work_date: date,
        start_time: g ? fmtMin(g.start) : row.schedule.start,
        end_time: g ? fmtMin(g.end) : row.schedule.end,
        activity_id: row.lastActivityId ?? '',
        project_id: row.lastProjectId ?? '',
      },
    });
  }

  function openBatch() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const first = rows.find((r) => r.employee.id === ids[0]);
    router.push({
      pathname: '/apontamentos/batch',
      params: {
        employees: ids.join(','),
        work_date: date,
        // sugere a lacuna do primeiro selecionado; se não houver, a jornada inteira
        start_time: first?.status === 'partial' ? fmtMin(first.analysis.gaps[0].start) : first?.schedule.start ?? '07:00',
        end_time: first?.status === 'partial' ? fmtMin(first.analysis.gaps[0].end) : first?.schedule.end ?? '17:00',
      },
    });
    setSelectMode(false);
    setSelected(new Set());
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function handleClose() {
    if (!teamId || !profile) return;
    const open = summary.partial + summary.none;
    const msg =
      open > 0 || summary.overlaps > 0
        ? `Ainda há ${summary.none} sem apontamento, ${summary.partial} parcial(is)` +
          (summary.overlaps ? ` e ${summary.overlaps} com horários sobrepostos` : '') +
          '. Fechar mesmo assim?'
        : 'Todos os funcionários estão com a jornada coberta. Fechar o dia?';
    if (await confirmAction('Fechar o dia', msg, 'Fechar o dia')) {
      await day.closeDay(teamId, date, profile.id);
    }
  }

  async function discardRejected() {
    const ops = await getOutbox();
    for (const o of ops.filter((x) => x.last_error)) await removeOp(o.id);
  }

  const allDone = summary.total > 0 && summary.complete + summary.absent === summary.total;

  const header = (
    <View style={styles.summaryWrap}>
      {roster.needsMigration && (
        <View style={[styles.banner, styles.bannerRed]}>
          <Text style={styles.bannerRedText}>
            O banco de dados ainda não tem as tabelas da chamada do dia. Rode o arquivo 004_daily_roster.sql no Supabase.
          </Text>
        </View>
      )}
      {roster.offline && (
        <View style={[styles.banner, styles.bannerGray]}>
          <Text style={styles.bannerGrayText}>Sem internet: mostrando os dados guardados no aparelho.</Text>
        </View>
      )}
      {roster.queuedCount > 0 && (
        <View style={[styles.banner, styles.bannerAmber]}>
          <Text style={styles.bannerAmberText}>
            {roster.queuedCount} alteraç{roster.queuedCount > 1 ? 'ões aguardam' : 'ão aguarda'} envio.
          </Text>
        </View>
      )}
      {roster.rejected.length > 0 && (
        <View style={[styles.banner, styles.bannerRed]}>
          <Text style={styles.bannerRedText}>O servidor recusou: {roster.rejected[0]}</Text>
          <Pressable onPress={discardRejected}>
            <Text style={styles.bannerLink}>Descartar</Text>
          </Pressable>
        </View>
      )}
      {roster.error ? (
        <View style={[styles.banner, styles.bannerRed]}>
          <Text style={styles.bannerRedText}>{roster.error}</Text>
        </View>
      ) : null}

      {teamDay?.no_work && (
        <View style={[styles.banner, styles.bannerGray]}>
          <Text style={styles.bannerGrayText}>
            Dia sem trabalho{teamDay.reason ? `: ${teamDay.reason}` : ''}
          </Text>
        </View>
      )}
      {teamDay?.closed_at && (
        <View style={[styles.banner, styles.bannerGreen]}>
          <Text style={styles.bannerGreenText}>
            Dia fechado às {new Date(teamDay.closed_at).toTimeString().slice(0, 5)}
          </Text>
          <Pressable onPress={() => teamId && day.reopenDay(teamId, date)}>
            <Text style={styles.bannerLink}>Reabrir</Text>
          </Pressable>
        </View>
      )}

      {summary.total > 0 && !teamDay?.no_work && (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>
            {allDone ? '✓ Todos em dia' : `${summary.complete} de ${summary.total} completos`}
          </Text>
          <View style={styles.pills}>
            {summary.partial > 0 && <Text style={[styles.pill, styles.pillAmber]}>{summary.partial} parcial(is)</Text>}
            {summary.none > 0 && <Text style={[styles.pill, styles.pillGray]}>{summary.none} sem apontamento</Text>}
            {summary.absent > 0 && <Text style={[styles.pill, styles.pillRed]}>{summary.absent} falta(s)</Text>}
            {summary.overlaps > 0 && <Text style={[styles.pill, styles.pillRed]}>{summary.overlaps} sobreposto(s)</Text>}
          </View>
        </View>
      )}
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      {canAdd && rows.length > 0 && (
        <>
          <TouchableOpacity style={styles.footBtn} onPress={() => { setSelectMode((v) => !v); setSelected(new Set()); }}>
            <Ionicons name="checkbox-outline" size={18} color={Colors.gray700} />
            <Text style={styles.footBtnText}>{selectMode ? 'Cancelar seleção' : 'Selecionar vários'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footBtn} onPress={() => setDaySheet(true)}>
            <Ionicons name="options-outline" size={18} color={Colors.gray700} />
            <Text style={styles.footBtnText}>Opções do dia</Text>
          </TouchableOpacity>
          {!teamDay?.closed_at && (
            <TouchableOpacity style={[styles.footBtn, styles.footBtnPrimary]} onPress={handleClose}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.white} />
              <Text style={[styles.footBtnText, { color: Colors.white }]}>Fechar o dia</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Olá, {profile?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subtitle}>{team?.name ?? 'Apontamentos'}</Text>
        </View>
        {canAdd && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push({ pathname: '/apontamentos/new', params: { work_date: date } })}
          >
            <Ionicons name="add" size={22} color={Colors.white} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dateTabs}>
        {dates.map((d) => (
          <TouchableOpacity key={d} style={[styles.dateTab, d === date && styles.dateTabActive]} onPress={() => setDate(d)}>
            <Text style={[styles.dateTabText, d === date && styles.dateTabTextActive]}>{labelDate(d)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.segment}>
        {(['equipe', 'registros'] as const).map((m) => (
          <TouchableOpacity key={m} style={[styles.segBtn, mode === m && styles.segBtnOn]} onPress={() => setMode(m)}>
            <Text style={[styles.segText, mode === m && styles.segTextOn]}>{m === 'equipe' ? 'Equipe' : 'Registros'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'registros' ? (
        <RecordsView date={date} onPressRecord={(id) => router.push(`/apontamentos/${id}`)} />
      ) : !canAdd ? (
        <Text style={styles.empty}>Seu perfil não registra apontamentos.</Text>
      ) : (
        <>
          {isManager && overview.length > 0 && (
            <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
              <Select
                options={overview.map((t) => ({ label: `${t.name}${t.closed ? '  ✓ fechado' : ''}`, value: t.id }))}
                value={teamId ?? ''}
                onChange={setTeamPick}
                placeholder="Escolha a equipe"
              />
            </View>
          )}
          <FlatList
            data={items}
            keyExtractor={(it, i) => (it.type === 'row' ? it.row.employee.id : `l${i}`)}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={roster.loading} onRefresh={roster.reload} tintColor={Colors.primary} />}
            ListHeaderComponent={header}
            ListFooterComponent={footer}
            renderItem={({ item }) =>
              item.type === 'label' ? (
                <Text style={styles.sectionLabel}>{item.text}</Text>
              ) : (
                <RosterRowCard
                  row={item.row}
                  expanded={expanded === item.row.employee.id}
                  onToggle={() =>
                    selectMode
                      ? toggleSelect(item.row.employee.id)
                      : setExpanded((cur) => (cur === item.row.employee.id ? null : item.row.employee.id))
                  }
                  selectMode={selectMode}
                  selected={selected.has(item.row.employee.id)}
                  canOpenRecord={(r: RosterRecord) => r.synced && (r.mine || isManager)}
                  onOpenRecord={(r) => router.push(`/apontamentos/${r.id}`)}
                  onAdd={(gap) => openAdd(item.row, gap)}
                  onJustify={(gap) => setIdleFor({ row: item.row, gap })}
                  onAbsence={() => setAbsenceFor(item.row)}
                  onDeleteIdle={async (id) => {
                    if (await confirmAction('Remover', 'Remover esta justificativa de horário?', 'Remover', true)) {
                      day.deleteIdleBlock(id);
                    }
                  }}
                />
              )
            }
            ListEmptyComponent={
              !roster.loading ? (
                <Text style={styles.empty}>
                  {teamId
                    ? 'Esta equipe ainda não tem funcionários. Cadastre em Funcionários.'
                    : isManager
                    ? 'Crie uma equipe em Configurações → Equipes.'
                    : 'Você ainda não está em uma equipe. Peça a um gerente para definir sua equipe.'}
                </Text>
              ) : null
            }
          />
          {selectMode && (
            <View style={styles.selectBar}>
              <Text style={styles.selectText}>{selected.size} selecionado(s)</Text>
              <TouchableOpacity
                style={[styles.selectGo, selected.size === 0 && { opacity: 0.4 }]}
                disabled={selected.size === 0}
                onPress={openBatch}
              >
                <Text style={styles.selectGoText}>Lançar para todos</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      <AbsenceSheet
        visible={!!absenceFor}
        employeeName={absenceFor?.employee.name ?? ''}
        existing={absenceFor?.absence ?? null}
        onClose={() => setAbsenceFor(null)}
        onSave={async (reason, note) => {
          if (!absenceFor || !profile) return;
          if (absenceFor.records.length > 0) {
            const ok = await confirmAction(
              'Funcionário com apontamentos',
              `${absenceFor.employee.name} já tem horário apontado hoje. Registrar falta mesmo assim?`,
              'Registrar falta'
            );
            if (!ok) return;
          }
          await day.setAbsence({ employeeId: absenceFor.employee.id, date, reason, note, createdBy: profile.id });
          setAbsenceFor(null);
        }}
        onRemove={async () => {
          if (absenceFor) await day.clearAbsence(absenceFor.employee.id, date);
          setAbsenceFor(null);
        }}
      />

      <IdleSheet
        visible={!!idleFor}
        employeeName={idleFor?.row.employee.name ?? ''}
        defaultStart={
          idleFor?.gap ? fmtMin(idleFor.gap.start) : idleFor?.row.analysis.gaps[0] ? fmtMin(idleFor.row.analysis.gaps[0].start) : idleFor?.row.schedule.start ?? ''
        }
        defaultEnd={
          idleFor?.gap ? fmtMin(idleFor.gap.end) : idleFor?.row.analysis.gaps[0] ? fmtMin(idleFor.row.analysis.gaps[0].end) : idleFor?.row.schedule.end ?? ''
        }
        onClose={() => setIdleFor(null)}
        onSave={async (start, end, reason, note) => {
          if (!idleFor || !profile) return;
          await day.addIdleBlock({ employeeId: idleFor.row.employee.id, date, start, end, reason, note, createdBy: profile.id });
          setIdleFor(null);
        }}
      />

      <DaySheet
        visible={daySheet}
        team={team}
        teamDay={teamDay}
        onClose={() => setDaySheet(false)}
        onSave={async (patch) => {
          if (!teamId) return;
          if (patch.no_work && summary.complete + summary.partial > 0) {
            const ok = await confirmAction(
              'Dia sem trabalho',
              'Já existem apontamentos neste dia. Marcar como dia sem trabalho mesmo assim?',
              'Marcar'
            );
            if (!ok) return;
          }
          try {
            await day.setTeamDay(teamId, date, patch);
            setDaySheet(false);
          } catch (e: any) {
            showMessage('Erro', e?.message ?? 'Não foi possível salvar.');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    // no navegador (web) não há barra de status para desviar; no app nativo sim
    paddingHorizontal: 16, paddingTop: HEADER_TOP_PADDING, paddingBottom: 8, backgroundColor: Colors.white,
  },
  greeting: { fontSize: 16, fontWeight: '700', color: Colors.text },
  subtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  addBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  dateTabs: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 4, backgroundColor: Colors.white,
    gap: 4,
  },
  dateTab: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  dateTabActive: { backgroundColor: Colors.primary },
  dateTabText: { fontSize: 13, color: Colors.gray500, fontWeight: '500' },
  dateTabTextActive: { color: Colors.white, fontWeight: '700' },
  segment: {
    flexDirection: 'row', backgroundColor: Colors.white, paddingHorizontal: 12, paddingBottom: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 6,
  },
  segBtn: { flex: 1, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.gray100, alignItems: 'center' },
  segBtnOn: { backgroundColor: Colors.primaryLight },
  segText: { fontSize: 13, fontWeight: '600', color: Colors.gray500 },
  segTextOn: { color: Colors.primaryDark },
  list: { padding: 12, gap: 8, paddingBottom: 120 },
  summaryWrap: { gap: 8, marginBottom: 4 },
  summary: {
    backgroundColor: Colors.white, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: Colors.border, gap: 8,
  },
  summaryTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  pillAmber: { backgroundColor: Colors.warningLight, color: '#b45309' },
  pillGray: { backgroundColor: Colors.gray100, color: Colors.gray600 },
  pillRed: { backgroundColor: Colors.dangerLight, color: Colors.danger },
  banner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 10, borderRadius: 10 },
  bannerRed: { backgroundColor: Colors.dangerLight },
  bannerRedText: { flex: 1, color: Colors.danger, fontSize: 12, fontWeight: '600' },
  bannerGray: { backgroundColor: Colors.gray100 },
  bannerGrayText: { flex: 1, color: Colors.gray600, fontSize: 12, fontWeight: '600' },
  bannerAmber: { backgroundColor: Colors.warningLight },
  bannerAmberText: { flex: 1, color: '#b45309', fontSize: 12, fontWeight: '600' },
  bannerGreen: { backgroundColor: Colors.primaryLight },
  bannerGreenText: { flex: 1, color: Colors.primaryDark, fontSize: 12, fontWeight: '600' },
  bannerLink: { color: Colors.primaryDark, fontWeight: '700', fontSize: 12 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', marginTop: 8 },
  empty: { textAlign: 'center', color: Colors.gray400, padding: 40, fontSize: 14 },
  footer: { gap: 8, marginTop: 8 },
  footBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12,
    borderRadius: 10, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  footBtnPrimary: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  footBtnText: { fontSize: 14, fontWeight: '600', color: Colors.gray700 },
  selectBar: {
    position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', backgroundColor: Colors.gray800, borderRadius: 12, padding: 12,
  },
  selectText: { color: Colors.white, fontWeight: '600' },
  selectGo: { backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  selectGoText: { color: Colors.white, fontWeight: '700' },
});
