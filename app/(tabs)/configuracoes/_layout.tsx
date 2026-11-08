import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function ConfiguracoesLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.white },
        headerTitleStyle: { fontWeight: '700', color: Colors.text },
        headerShadowVisible: false,
        headerTintColor: Colors.primary,
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="equipes/index" options={{ title: 'Equipes' }} />
      <Stack.Screen name="equipes/[id]" options={{ title: 'Equipe' }} />
      <Stack.Screen name="usuarios/index" options={{ title: 'Usuários' }} />
      <Stack.Screen name="usuarios/[id]" options={{ title: 'Usuário' }} />
    </Stack>
  );
}
