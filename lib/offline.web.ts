import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApontamentoFormData, OfflineMeta } from '../types';

// Versão web da fila offline: usa o armazenamento do navegador (expo-sqlite
// no web é experimental). A API é idêntica à de offline.ts.

const KEY = 'offline_apontamentos';

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
  meta: OfflineMeta;
}

async function readAll(): Promise<OfflineApontamento[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

async function writeAll(items: OfflineApontamento[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function saveOffline(
  data: ApontamentoFormData,
  leaderId: string,
  meta: OfflineMeta
): Promise<string> {
  const id = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const items = await readAll();
  items.push({
    id,
    employee_id: data.employee_id,
    activity_id: data.activity_id,
    leader_id: leaderId,
    work_date: data.work_date,
    start_time: data.start_time,
    end_time: data.end_time,
    notes: data.notes || null,
    field_values: data.field_values,
    synced: false,
    created_at: new Date().toISOString(),
    retry_count: 0,
    meta,
  });
  await writeAll(items);
  return id;
}

export async function getPendingSync(): Promise<OfflineApontamento[]> {
  return (await readAll()).filter((i) => !i.synced);
}

export async function markSynced(localId: string) {
  const items = await readAll();
  await writeAll(items.map((i) => (i.id === localId ? { ...i, synced: true } : i)));
}

export async function incrementRetry(localId: string) {
  const items = await readAll();
  await writeAll(
    items.map((i) => (i.id === localId ? { ...i, retry_count: i.retry_count + 1 } : i))
  );
}

export async function deleteOffline(localId: string) {
  const items = await readAll();
  await writeAll(items.filter((i) => i.id !== localId));
}
