import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { cacheGet, cacheSet } from '../lib/cache';
import { getPendingSync } from '../lib/offline';
import { getOutbox, overlayRows } from '../lib/outbox';
import { onQueueChange, isNetworkError } from '../lib/sync';
import { shortTime } from '../lib/date';
import {
  Analysis,
  DayStatus,
  Schedule,
  analyze,
  dayStatus,
  resolveSchedule,
} from '../lib/coverage';
import { Absence, Employee, IdleBlock, Team, TeamDay } from '../types';

export interface RosterRecord {
  id: string;
  start: string;
  end: string;
  activityId: string;
  activityName: string;
  projectId: string;
  projectName: string;
  leaderId: string;
  leaderName: string;
  mine: boolean;
  synced: boolean;
  summary: string;
}

export interface RosterRow {
  employee: { id: string; name: string; teamId: string | null; teamName: string | null };
  borrowed: boolean; // não é da equipe exibida (veio emprestado para este líder)
  schedule: Schedule;
  records: RosterRecord[];
  idle: IdleBlock[];
  absence: Absence | null;
  analysis: Analysis;
  status: DayStatus;
  lastActivityId: string | null;
  lastProjectId: string | null;
}

export interface RosterSummary {
  total: number;
  complete: number;
  partial: number;
  none: number;
  absent: number;
  noWork: number;
  overlaps: number;
}

interface Bundle {
  team: Team | null;
  employees: Employee[];
  apontamentos: any[];
  absences: Absence[];
  idle: IdleBlock[];
  teamDay: TeamDay | null;
}

const EMPTY_SUMMARY: RosterSummary = {
  total: 0, complete: 0, partial: 0, none: 0, absent: 0, noWork: 0, overlaps: 0,
};

function isMissingTable(err: any): boolean {
  const text = `${err?.code ?? ''} ${err?.message ?? ''}`;
  return /42P01|PGRST205|does not exist|schema cache|Could not find the table/i.test(text);
}

async function fetchBundle(
  teamId: string,
  date: string,
  profileId: string
): Promise<{ bundle: Bundle; needsMigration: boolean }> {
  const [teamRes, empRes] = await Promise.all([
    supabase.from('teams').select('*').eq('id', teamId).maybeSingle(),
    supabase
      .from('employees')
      .select('*, team:teams(*)')
      .eq('team_id', teamId)
      .eq('active', true)
      .order('name'),
  ]);
  if (teamRes.error) throw teamRes.error;
  if (empRes.error) throw empRes.error;
  const employees = (empRes.data as Employee[]) ?? [];
  const ids = employees.map((e) => e.id);

  // registros dos funcionários da equipe (de qualquer líder) + os que EU lancei (emprestados)
  const orFilter = ids.length
    ? `employee_id.in.(${ids.join(',')}),leader_id.eq.${profileId}`
    : `leader_id.eq.${profileId}`;
  const apRes = await supabase
    .from('apontamentos')
    .select(
      `id, local_id, employee_id, activity_id, project_id, leader_id, work_date, start_time, end_time,
       employee:employees(*, team:teams(*)),
       activity:activities(id, name),
       project:projects(id, name),
       leader:profiles!leader_id(id, name),
       field_values:apontamento_field_values(value, field:activity_fields(name, unit, field_type))`
    )
    .eq('work_date', date)
    .or(orFilter);
  if (apRes.error) throw apRes.error;
  const apontamentos = (apRes.data as any[]) ?? [];

  const allIds = Array.from(new Set([...ids, ...apontamentos.map((a) => a.employee_id)]));

  let needsMigration = false;
  const guard = <T,>(res: { data: T | null; error: any }, fallback: T): T => {
    if (res.error) {
      if (isMissingTable(res.error)) {
        needsMigration = true;
        return fallback;
      }
      throw res.error;
    }
    return (res.data as T) ?? fallback;
  };

  const [absRes, idleRes, dayRes] = await Promise.all([
    allIds.length
      ? supabase.from('absences').select('*').eq('work_date', date).in('employee_id', allIds)
      : Promise.resolve({ data: [] as Absence[], error: null }),
    allIds.length
      ? supabase.from('idle_blocks').select('*').eq('work_date', date).in('employee_id', allIds)
      : Promise.resolve({ data: [] as IdleBlock[], error: null }),
    supabase.from('team_days').select('*').eq('team_id', teamId).eq('work_date', date).maybeSingle(),
  ]);

  return {
    needsMigration,
    bundle: {
      team: (teamRes.data as Team) ?? null,
      employees,
      apontamentos,
      absences: guard(absRes as any, [] as Absence[]),
      idle: guard(idleRes as any, [] as IdleBlock[]),
      teamDay: guard(dayRes as any, null as TeamDay | null),
    },
  };
}

function fieldSummary(ap: any): string {
  return (ap.field_values ?? [])
    .filter((fv: any) => fv?.field)
    .map((fv: any) => `${fv.field.name}: ${fv.value}${fv.field.unit ? ` ${fv.field.unit}` : ''}`)
    .join(' · ');
}

export function useRoster(teamId: string | null, date: string) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<RosterRow[]>([]);
  const [summary, setSummary] = useState<RosterSummary>(EMPTY_SUMMARY);
  const [team, setTeam] = useState<Team | null>(null);
  const [teamDay, setTeamDay] = useState<TeamDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [rejected, setRejected] = useState<string[]>([]);
  // última base de dados conhecida deste dia (para atualizar a tela na hora, sem esperar a rede)
  const baseRef = useRef<{ key: string; bundle: Bundle } | null>(null);

  const compute = useCallback(
    async (bundle: Bundle) => {
      if (!profile) return;
      const ops = await getOutbox();
      const pending = (await getPendingSync()).filter(
        (p) => p.work_date === date && p.leader_id === profile.id
      );
      const cachedAll = (await cacheGet<Employee[]>('employees:all')) ?? [];

      const absences = overlayRows(bundle.absences, 'absences', ops).filter((a) => a.work_date === date);
      const idleAll = overlayRows(bundle.idle, 'idle_blocks', ops).filter((b) => b.work_date === date);
      const dayRows = overlayRows(bundle.teamDay ? [bundle.teamDay] : [], 'team_days', ops).filter(
        (d) => d.team_id === teamId && d.work_date === date
      );
      const day = (dayRows[0] as TeamDay | undefined) ?? null;

      // funcionários conhecidos: da equipe + emprestados que apareceram nos registros
      const empMap = new Map<string, Employee>();
      bundle.employees.forEach((e) => empMap.set(e.id, e));
      bundle.apontamentos.forEach((a) => a.employee && !empMap.has(a.employee_id) && empMap.set(a.employee_id, a.employee));
      pending.forEach((p) => {
        if (!empMap.has(p.employee_id)) {
          const known = cachedAll.find((e) => e.id === p.employee_id);
          empMap.set(
            p.employee_id,
            known ?? ({ id: p.employee_id, name: p.meta?.employee_name ?? 'Funcionário', team_id: null } as Employee)
          );
        }
      });

      const serverLocalIds = new Set(bundle.apontamentos.map((a) => a.local_id).filter(Boolean));
      const recordsByEmp = new Map<string, RosterRecord[]>();
      const push = (empId: string, rec: RosterRecord) => {
        const list = recordsByEmp.get(empId) ?? [];
        list.push(rec);
        recordsByEmp.set(empId, list);
      };
      bundle.apontamentos.forEach((a) =>
        push(a.employee_id, {
          id: a.id,
          start: shortTime(a.start_time),
          end: shortTime(a.end_time),
          activityId: a.activity_id,
          activityName: a.activity?.name ?? 'Atividade',
          projectId: a.project_id,
          projectName: a.project?.name ?? 'Projeto',
          leaderId: a.leader_id,
          leaderName: a.leader?.name ?? 'outro líder',
          mine: a.leader_id === profile.id,
          synced: true,
          summary: fieldSummary(a),
        })
      );
      pending
        .filter((p) => !serverLocalIds.has(p.id))
        .forEach((p) =>
          push(p.employee_id, {
            id: p.id,
            start: shortTime(p.start_time),
            end: shortTime(p.end_time),
            activityId: p.activity_id,
            activityName: p.meta?.activity_name ?? 'Atividade',
            projectId: p.project_id,
            projectName: p.meta?.project_name ?? 'Projeto',
            leaderId: p.leader_id,
            leaderName: profile.name,
            mine: true,
            synced: false,
            summary: (p.meta?.fields ?? [])
              .map((f) => `${f.name}: ${f.value}${f.unit ? ` ${f.unit}` : ''}`)
              .join(' · '),
          })
        );

      const teamMemberIds = new Set(bundle.employees.map((e) => e.id));
      const order = [
        ...bundle.employees.map((e) => e.id),
        ...Array.from(recordsByEmp.keys()).filter((id) => !teamMemberIds.has(id)),
      ];

      const built: RosterRow[] = order.map((empId) => {
        const emp = empMap.get(empId)!;
        const isMember = teamMemberIds.has(empId);
        const records = (recordsByEmp.get(empId) ?? []).sort((a, b) => a.start.localeCompare(b.start));
        const idle = idleAll
          .filter((b) => b.employee_id === empId)
          .map((b) => ({ ...b, start_time: shortTime(b.start_time), end_time: shortTime(b.end_time) }))
          .sort((a, b) => a.start_time.localeCompare(b.start_time));
        const absence = absences.find((a) => a.employee_id === empId) ?? null;
        const schedule = resolveSchedule(
          isMember ? bundle.team : emp.team,
          emp,
          isMember ? day : null
        );
        const blocks = [
          ...records.map((r) => ({ start: r.start, end: r.end, kind: 'work' as const })),
          ...idle.map((b) => ({ start: b.start_time, end: b.end_time, kind: 'idle' as const })),
        ];
        const analysis = analyze(schedule, blocks);
        const status = dayStatus({
          noWork: isMember && !!day?.no_work,
          absent: !!absence,
          blockCount: blocks.length,
          analysis,
        });
        const mine = records.filter((r) => r.mine);
        return {
          employee: {
            id: emp.id,
            name: emp.name,
            teamId: emp.team_id ?? null,
            teamName: emp.team?.name ?? null,
          },
          borrowed: !isMember,
          schedule,
          records,
          idle,
          absence,
          analysis,
          status,
          lastActivityId: mine.length ? mine[mine.length - 1].activityId : null,
          lastProjectId: mine.length ? mine[mine.length - 1].projectId : null,
        };
      });

      const members = built.filter((r) => !r.borrowed);
      setSummary({
        total: members.length,
        complete: members.filter((r) => r.status === 'complete').length,
        partial: members.filter((r) => r.status === 'partial').length,
        none: members.filter((r) => r.status === 'none').length,
        absent: members.filter((r) => r.status === 'absent').length,
        noWork: members.filter((r) => r.status === 'no_work').length,
        overlaps: built.filter((r) => r.analysis.overlaps.length > 0).length,
      });
      setRows(built);
      setTeam(bundle.team);
      setTeamDay(day);
      setQueuedCount(pending.filter((p) => !serverLocalIds.has(p.id)).length + ops.length);
      setRejected(ops.filter((o) => o.last_error).map((o) => o.last_error as string));
    },
    [profile?.id, profile?.name, teamId, date]
  );

  const load = useCallback(async () => {
    if (!profile || !teamId) {
      setRows([]);
      setSummary(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }
    const cacheKey = `roster:${teamId}:${date}`;
    setError('');

    // 1) mostra já o que está guardado no aparelho (não espera a rede)
    if (baseRef.current?.key !== cacheKey) {
      const cached = await cacheGet<Bundle>(cacheKey);
      if (cached) {
        baseRef.current = { key: cacheKey, bundle: cached };
        await compute(cached);
        setLoading(false);
      } else {
        baseRef.current = null;
        setLoading(true);
      }
    }

    // 2) aparelho sabe que está sem rede: não adianta tentar (o cliente insiste ~7s)
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      setOffline(true);
      if (baseRef.current) {
        await compute(baseRef.current.bundle);
      } else {
        // sem internet e sem cópia deste dia: monta só com o que está no aparelho
        const all = await cacheGet<Employee[]>('employees:all');
        const members = (all ?? []).filter((x) => x.team_id === teamId);
        await compute({
          team: members[0]?.team ?? null,
          employees: members,
          apontamentos: [],
          absences: [],
          idle: [],
          teamDay: null,
        });
      }
      setLoading(false);
      return;
    }

    // 3) busca no servidor e atualiza
    try {
      const { bundle, needsMigration: nm } = await fetchBundle(teamId, date, profile.id);
      setNeedsMigration(nm);
      setOffline(false);
      baseRef.current = { key: cacheKey, bundle };
      cacheSet(cacheKey, bundle);
      await compute(bundle);
    } catch (e: any) {
      setOffline(isNetworkError(e));
      if (!isNetworkError(e)) setError(e?.message ?? 'Erro ao carregar');
      if (baseRef.current) await compute(baseRef.current.bundle);
    }
    setLoading(false);
  }, [profile?.id, teamId, date, compute]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(
    () =>
      onQueueChange(() => {
        if (baseRef.current) compute(baseRef.current.bundle); // reflete a alteração imediatamente
        load();
      }),
    [load, compute]
  );

  return {
    rows, summary, team, teamDay, loading, error, offline, needsMigration,
    queuedCount, rejected, reload: load,
  };
}

/** Para gerente/diretor: equipes e se o dia de cada uma já foi fechado. */
export function useTeamsOverview(date: string) {
  const [teams, setTeams] = useState<(Team & { closed: boolean })[]>([]);

  const load = useCallback(async () => {
    try {
      const [t, d] = await Promise.all([
        supabase.from('teams').select('*').order('name'),
        supabase.from('team_days').select('team_id, closed_at').eq('work_date', date),
      ]);
      if (t.error) throw t.error;
      const closedSet = new Set(((d.data as any[]) ?? []).filter((x) => x.closed_at).map((x) => x.team_id));
      const list = ((t.data as Team[]) ?? []).map((x) => ({ ...x, closed: closedSet.has(x.id) }));
      setTeams(list);
      cacheSet('teams_overview', list);
    } catch {
      const cached = await cacheGet<(Team & { closed: boolean })[]>('teams_overview');
      if (cached) setTeams(cached);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => onQueueChange(() => { load(); }), [load]);

  return teams;
}
