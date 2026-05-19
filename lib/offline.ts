import * as SQLite from 'expo-sqlite';
import { ApontamentoFormData } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('agroapp.db');
    await initSchema(db);
  }
  return db;
}

async function initSchema(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS offline_apontamentos (
      id TEXT PRIMARY KEY,
      employee_id TEXT NOT NULL,
      activity_id TEXT NOT NULL,
      leader_id TEXT NOT NULL,
      work_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      notes TEXT,
      field_values TEXT NOT NULL DEFAULT '{}',
      synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export interface OfflineApontamento {
  id: string;
  employee_id: string;
  activity_id: string;
  leader_id: string;
  work_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  field_values: Record<string, string>;
  synced: boolean;
  created_at: string;
  retry_count: number;
}

export async function saveOffline(
  data: ApontamentoFormData,
  leaderId: string
): Promise<string> {
  const db = await getDb();
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO offline_apontamentos
      (id, employee_id, activity_id, leader_id, work_date, start_time, end_time, notes, field_values, synced, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      id,
      data.employee_id,
      data.activity_id,
      leaderId,
      data.work_date,
      data.start_time,
      data.end_time,
      data.notes || null,
      JSON.stringify(data.field_values),
      now,
    ]
  );
  return id;
}

export async function getPendingSync(): Promise<OfflineApontamento[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    `SELECT * FROM offline_apontamentos WHERE synced = 0 ORDER BY created_at ASC`
  );
  return rows.map((r) => ({
    ...r,
    field_values: JSON.parse(r.field_values || '{}'),
    synced: r.synced === 1,
  }));
}

export async function markSynced(localId: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_apontamentos SET synced = 1 WHERE id = ?`,
    [localId]
  );
}

export async function incrementRetry(localId: string) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE offline_apontamentos SET retry_count = retry_count + 1 WHERE id = ?`,
    [localId]
  );
}

export async function deleteOffline(localId: string) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM offline_apontamentos WHERE id = ?`, [localId]);
}
