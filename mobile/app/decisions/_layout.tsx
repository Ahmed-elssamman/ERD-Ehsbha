import { Stack } from 'expo-router';

export default function DecisionsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#0B0F14' },
      }}
    />
  );
}
