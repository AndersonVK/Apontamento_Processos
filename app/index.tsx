import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

// Rota raiz: manda para o login ou para a tela principal conforme a sessão.
export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return null;
  return <Redirect href={session ? '/(tabs)/apontamentos' : '/(auth)/login'} />;
}
