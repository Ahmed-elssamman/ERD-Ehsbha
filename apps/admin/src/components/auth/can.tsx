import type { ReactNode } from 'react';
import { useAdminAuth } from '@/stores/admin-auth.store';

interface CanProps {
  permission?: string;
  anyOf?: string[];
  allOf?: string[];
  fallback?: ReactNode;
  children: ReactNode;
}

export function Can({ permission, anyOf, allOf, fallback = null, children }: CanProps) {
  const hasPermission = useAdminAuth((s) => s.hasPermission);
  const hasAnyPermission = useAdminAuth((s) => s.hasAnyPermission);

  const ok =
    (permission ? hasPermission(permission) : true) &&
    (anyOf ? hasAnyPermission(anyOf) : true) &&
    (allOf ? allOf.every((p) => hasPermission(p)) : true);

  return ok ? <>{children}</> : <>{fallback}</>;
}
