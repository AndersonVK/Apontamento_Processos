import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { syncPending } from '../lib/sync';
import { useAuth } from '../contexts/AuthContext';

/** Sincroniza a fila offline ao abrir o app, ao voltar para ele e quando a internet volta. */
export function useAutoSync() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;

    syncPending().catch(() => {});

    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) syncPending().catch(() => {});
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncPending().catch(() => {});
    });
    // rede instável: nova tentativa periódica enquanto o app está aberto
    const timer = setInterval(() => syncPending().catch(() => {}), 60000);

    return () => {
      unsubNet();
      sub.remove();
      clearInterval(timer);
    };
  }, [session?.user?.id]);
}
