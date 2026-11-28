import AsyncStorage from '@react-native-async-storage/async-storage';

export async function cacheSet(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(`cache:${key}`, JSON.stringify(value));
  } catch {}
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`cache:${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Apaga as cópias guardadas de dias antigos (a chamada de cada dia ocupa espaço). */
export async function pruneOldRosterCache(keepDays = 30): Promise<void> {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - keepDays);
    const limit = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter((k) => {
      const m = /^cache:roster2?:.+:(\d{4}-\d{2}-\d{2})$/.exec(k);
      return !!m && m[1] < limit;
    });
    if (stale.length) await AsyncStorage.multiRemove(stale);
  } catch {}
}
