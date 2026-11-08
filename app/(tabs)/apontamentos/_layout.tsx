import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function ApontamentosLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.white },
        headerTitleStyle: { fontWeight: '700', color: Colors.text },
        headerShadowVisible: false,
        headerTintColor: Colors.primary,
        headerBackTitle: 'Voltar',
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'Novo apontamento' }} />
      <Stack.Screen name="[id]" options={{ title: 'Apontamento' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Editar apontamento' }} />
    </Stack>
  );
}
