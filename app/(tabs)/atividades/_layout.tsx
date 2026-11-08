import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function AtividadesLayout() {
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
      <Stack.Screen name="new" options={{ title: 'Nova atividade' }} />
      <Stack.Screen name="[id]" options={{ title: 'Atividade' }} />
      <Stack.Screen name="field/new" options={{ title: 'Novo campo' }} />
    </Stack>
  );
}
