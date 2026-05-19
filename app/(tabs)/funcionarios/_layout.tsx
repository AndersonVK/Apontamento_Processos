import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function FuncionariosLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.white },
        headerTitleStyle: { fontWeight: '700', color: Colors.text },
        headerShadowVisible: false,
        headerTintColor: Colors.primary,
      }}
    />
  );
}
