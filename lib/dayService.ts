import { enqueueDelete, enqueueUpsert, newId } from './outbox';
import { syncPending } from './sync';
import { AbsenceReason, IdleReason } from '../types';

// Ações da chamada do dia. Cada uma grava na fila local (a tela atualiza na hora)
// e tenta enviar em seguida; sem rede, vai quando a conexão voltar.

const flush = () => {
  syncPending().catch(() => {});
};

export async function setAbsence(args: {
  employeeId: string;
  date: string;
  reason: AbsenceReason;
  note: string;
  createdBy: string;
}) {
  await enqueueUpsert('absences', {
    employee_id: args.employeeId,
    work_date: args.date,
    reason_type: args.reason,
    note: args.note.trim() || null,
    created_by: args.createdBy,
  });
  flush();
}

export async function clearAbsence(employeeId: string, date: string) {
  await enqueueDelete('absences', { employee_id: employeeId, work_date: date });
  flush();
}

export async function addIdleBlock(args: {
  employeeId: string;
  date: string;
  start: string;
  end: string;
  reason: IdleReason;
  note: string;
  createdBy: string;
}) {
  await enqueueUpsert('idle_blocks', {
    id: newId(),
    employee_id: args.employeeId,
    work_date: args.date,
    start_time: args.start,
    end_time: args.end,
    reason_type: args.reason,
    note: args.note.trim() || null,
    created_by: args.createdBy,
  });
  flush();
}

export async function deleteIdleBlock(id: string) {
  await enqueueDelete('idle_blocks', { id });
  flush();
}

export async function setTeamDay(
  teamId: string,
  date: string,
  patch: Record<string, any>
) {
  await enqueueUpsert('team_days', { team_id: teamId, work_date: date, ...patch });
  flush();
}

export async function closeDay(teamId: string, date: string, byProfileId: string) {
  await setTeamDay(teamId, date, { closed_at: new Date().toISOString(), closed_by: byProfileId });
}

export async function reopenDay(teamId: string, date: string) {
  await setTeamDay(teamId, date, { closed_at: null, closed_by: null });
}
