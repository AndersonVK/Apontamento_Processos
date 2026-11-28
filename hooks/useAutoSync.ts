import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncPending } from '../lib/sync';
import { pruneOldRosterCache } from '../lib/cache';
import { useAuth } from '../contexts/AuthContext';

/** Sincroniza a fila offline ao abrir o app, ao voltar para ele e quando a internet volta. */
export function useAutoSync() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;

    syncPending().catch(() => {});
    pruneOldRosterCache();

    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) syncPending().catch(() => {});
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncPending().catch(() => {});
    });
    // Na web, o NetInfo ignora o evento "online" quando o navegador tem navigator.connection
    const onOnline = () => syncPending().catch(() => {});
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', onOnline);
    }
    // rede instável: nova tentativa periódica enquanto o app está aberto
    const timer = setInterval(() => syncPending().catch(() => {}), 60000);

    return () => {
      unsubNet();
      sub.remove();
      clearInterval(timer);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline);
      }
    };
  }, [session?.user?.id]);
}
