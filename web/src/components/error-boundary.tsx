import { useEffect } from 'react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/i18n';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const t = useT();
  const navigate = useNavigate();

  useEffect(() => {
    if (error) {
      // Keep this — surfaces silent failures in dev consoles
      // eslint-disable-next-line no-console
      console.error('[route error]', error);
    }
  }, [error]);

  const status = isRouteErrorResponse(error) ? error.status : undefined;
  const heading = status === 404 ? t('errors.notFoundTitle') : t('errors.routeTitle');
  const body = status === 404 ? t('errors.notFoundBody') : t('errors.routeBody');

  const handleRetry = () => {
    if (typeof window !== 'undefined') window.location.reload();
  };
  const handleHome = () => navigate('/', { replace: true });

  return (
    <div className="grid min-h-dvh place-items-center bg-background px-6 py-12 text-center">
      <div className="max-w-md">
        <span className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="h-7 w-7" aria-hidden />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
          <Button onClick={handleRetry} className="gap-2">
            <RefreshCw className="h-4 w-4" aria-hidden />
            {t('errors.routeRetry')}
          </Button>
          <Button variant="ghost" onClick={handleHome} className="gap-2">
            <Home className="h-4 w-4" aria-hidden />
            {t('errors.routeHome')}
          </Button>
        </div>
      </div>
    </div>
  );
}
