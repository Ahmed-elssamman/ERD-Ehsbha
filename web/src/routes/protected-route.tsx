import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/stores/auth.store';

export function ProtectedRoute({ children }: PropsWithChildren) {
  const location = useLocation();
  const hydrated = useAuth((s) => s.hydrated);
  const refreshToken = useAuth((s) => s.refreshToken);
  const user = useAuth((s) => s.user);

  if (!hydrated) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" aria-label="loading" />
      </div>
    );
  }

  // If we have a refresh token but no user (e.g. fresh load), still allow in —
  // the API client will refresh and either populate or kick to /login.
  if (!refreshToken && !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

export function GuestRoute({ children }: PropsWithChildren) {
  const hydrated = useAuth((s) => s.hydrated);
  const refreshToken = useAuth((s) => s.refreshToken);

  if (!hydrated) return null;
  if (refreshToken) return <Navigate to="/" replace />;
  return <>{children}</>;
}
