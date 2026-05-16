import { Stack } from 'expo-router';

export default function ExpensesStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_bottom',
        contentStyle: { backgroundColor: '#0B0F14' },
      }}
    />
  );
}
