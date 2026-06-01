import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { tripsApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/provider';
import { formatNumber, formatPiastres } from '@/lib/utils';

interface Row {
  label: string;
  value: React.ReactNode;
}

function MiniRows({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="contents">
          <dt className="text-muted-foreground whitespace-nowrap">{r.label}</dt>
          <dd className="min-w-0 break-words text-right font-medium">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TripDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'trip', id],
    queryFn: () => tripsApi.get(id),
    enabled: Boolean(id),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center text-danger">
        Failed to load trip. <Link to="/trips" className="text-primary underline">Back</Link>
      </div>
    );
  }

  const trip = data as {
    id: string;
    startedAt: string;
    endedAt: string;
    grossPiastres: number;
    receivedPiastres: number | null;
    tipPiastres: number;
    commissionPiastres: number;
    tollPiastres: number;
    parkingPiastres: number;
    totalKmMeters: number;
    paidKmMeters: number;
    emptyKmMeters: number;
    notes: string | null;
    driverId: string;
    driver: { displayName: string; user: { phone: string; email: string | null } };
    driverApp: { customName: string | null; appSource: { name: string; code: string } };
    vehicle: { id: string; type: string; make: string | null; model: string | null; year: number | null };
    area: { name: string } | null;
  };

  const durationMin = Math.max(0, Math.round((new Date(trip.endedAt).getTime() - new Date(trip.startedAt).getTime()) / 60000));

  return (
    <div className="mx-auto max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/trips')} className="mb-4">
        <ArrowLeft className="h-4 w-4" />
        {t('trips.backToTrips')}
      </Button>

      <PageHeader title={`#${trip.id.slice(-8)}`} description={`${new Date(trip.startedAt).toLocaleString()} · ${durationMin} min`} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t('trips.financials')}</CardTitle></CardHeader>
          <CardContent>
            <MiniRows
              rows={[
                { label: t('trips.grossLabel'), value: formatPiastres(trip.grossPiastres) },
                { label: t('trips.received'), value: trip.receivedPiastres != null ? formatPiastres(trip.receivedPiastres) : '—' },
                { label: t('trips.tip'), value: formatPiastres(trip.tipPiastres) },
                { label: t('trips.commission'), value: formatPiastres(trip.commissionPiastres) },
                { label: t('trips.toll'), value: formatPiastres(trip.tollPiastres) },
                { label: t('trips.parking'), value: formatPiastres(trip.parkingPiastres) },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('trips.distance')}</CardTitle></CardHeader>
          <CardContent>
            <MiniRows
              rows={[
                { label: t('trips.total'), value: `${formatNumber(Math.round(trip.totalKmMeters / 10) / 100)} km` },
                { label: t('trips.paid'), value: `${formatNumber(Math.round(trip.paidKmMeters / 10) / 100)} km` },
                { label: t('trips.empty'), value: `${formatNumber(Math.round(trip.emptyKmMeters / 10) / 100)} km` },
                { label: t('trips.emptyPct'), value: `${Math.round((trip.emptyKmMeters / Math.max(1, trip.totalKmMeters)) * 100)}%` },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('trips.driverApp')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="min-w-0">
              <div className="text-muted-foreground text-xs uppercase tracking-wider">{t('drivers.title')}</div>
              <Link to={`/drivers/${trip.driverId}`} className="break-words font-medium text-primary hover:underline">
                {trip.driver.displayName}
              </Link>
              <div className="font-mono text-xs text-muted-foreground break-all">{trip.driver.user.phone}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">{t('trips.app')}</div>
              <Badge variant="outline">{trip.driverApp.customName ?? trip.driverApp.appSource.name}</Badge>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">{t('trips.area')}</div>
              <div className="break-words">{trip.area?.name ?? '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground text-xs uppercase tracking-wider">{t('trips.vehicle')}</div>
              <div className="break-words">{trip.vehicle.type} {[trip.vehicle.make, trip.vehicle.model, trip.vehicle.year].filter(Boolean).join(' ')}</div>
            </div>
          </CardContent>
        </Card>

        {trip.notes && (
          <Card>
            <CardHeader><CardTitle>{t('trips.notes')}</CardTitle></CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap break-words text-sm">{trip.notes}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
