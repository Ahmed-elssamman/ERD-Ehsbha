import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '@/stores/admin-auth.store';

export function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const session = useAdminAuth((s) => s.session);
  const location = useLocation();
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

export function AdminGuestRoute({ children }: { children: ReactNode }) {
  const session = useAdminAuth((s) => s.session);
  if (session) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const hasPermission = useAdminAuth((s) => s.hasPermission);
  if (!hasPermission(permission)) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold">403 — Forbidden</h1>
          <p className="mt-2 text-muted-foreground">
            You don&apos;t have permission to view this page.
          </p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
