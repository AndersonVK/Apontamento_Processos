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
