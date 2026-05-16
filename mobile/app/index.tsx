import { Redirect } from 'expo-router';
import { useAuth } from '@/stores/auth.store';

export default function Index() {
  const user = useAuth((s) => s.user);
  if (user) return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/(auth)/welcome" />;
}
