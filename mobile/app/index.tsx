import React from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/stores/auth.store';
import { go, ROUTES } from '@/constants/routes';

export default function Index(): React.ReactElement {
  const user = useAuth((s) => s.user);
  if (user) return <Redirect href={go(ROUTES.HOME)} />;
  return <Redirect href={go(ROUTES.WELCOME)} />;
}
