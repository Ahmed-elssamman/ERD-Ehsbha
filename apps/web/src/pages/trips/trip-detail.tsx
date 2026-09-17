import { tripEarningsPiastres } from '@ehsbha/shared-types';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TripStatusDialog } from './trip-status-dialog';
import { TripHistory } from './trip-history';
import { PageHeader } from '@/components/ui/page-header';
import { useI18n } from '@/i18n';
import { TripsApi, type TripItem } from '@/lib/api/endpoints';
import { formatDate, formatKm, formatMoney, formatTime } from '@/lib/format';
import { durationMinutes } from '@/lib/time';
import { TRIP_QUERY_KEYS } from './trip-draft.control';
import { TripForm } from './trip-form';
import { OCR_PAYMENT_OPTIONS } from '@/components/ocr/ocr-review.control';

export function TripDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [statusTarget, setStatusTarget] = useState<TripItem | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: trip, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => TripsApi.get(id),
    enabled: !!id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  function statusSaved() {
    setStatusTarget(null);
    for (const key of TRIP_QUERY_KEYS) void qc.invalidateQueries({ queryKey: [key] });
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!trip) {
    return (
      <div className="space-y-4 animate-fade-in">
        <PageHeader title={t(isError ? 'trips.loadFailed' : 'errors.TRIP_NOT_FOUND')} />
        <Button onClick={() => void refetch()}>{t('common.retry')}</Button>
        <Button onClick={() => navigate('/trips')} className="gap-2">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('trips.back')}
        </Button>
      </div>
    );
  }

  const net = tripEarningsPiastres(trip);
  const duration = durationMinutes(trip.startedAt, trip.endedAt);
  const paymentLabelKey = OCR_PAYMENT_OPTIONS.find((option) => option.value === trip.paymentMethod)?.labelKey ?? 'trips.ocr.paymentUnknown';

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title={editing ? t('trips.edit') : `${formatMoney(net, locale)}`}
        subtitle={editing ? undefined : `${formatDate(trip.startedAt, locale, { day: 'numeric', month: 'short', year: 'numeric' })} · ${formatTime(trip.startedAt, locale)}`}
        actions={
          editing ? (
            <Button variant="ghost" onClick={() => setEditing(false)} className="gap-1.5">
              <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
              {t('common.cancel')}
            </Button>
          ) : (
            <>
              <Button disabled={isFetching || !!trip.deletedAt} variant="outline" onClick={() => setEditing(true)} className="gap-2">
                <Edit2 className="h-4 w-4" aria-hidden />
                {t('common.edit')}
              </Button>
              <Button disabled={isFetching} variant="destructive" onClick={() => setStatusTarget(trip)} className="gap-2">
                <Trash2 className="h-4 w-4" aria-hidden />
                {t(trip.deletedAt ? 'trips.restore' : 'common.delete')}
              </Button>
              <Button variant="outline" onClick={() => setHistoryOpen(true)}>{t('trips.history')}</Button>
            </>
          )
        }
      />

      <p className="text-sm text-muted-foreground">{t(`trips.source.${trip.source}`)} · {t('trips.version')} {trip.version} · {t(trip.deletedAt ? 'trips.view.deleted' : 'trips.view.active')}</p>
      {!editing ? (
        <>
          {trip.grossPiastres === null ? <p role="status" className="rounded-lg border p-3 text-sm text-muted-foreground">{t('trips.finance.missingDetails')}</p> : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t('trips.tripGross')} value={formatMoney(trip.grossPiastres, locale)} />
            <Stat label={t('trips.tripCommission')} value={formatMoney(trip.commissionPiastres, locale)} />
            <Stat label={t('trips.tripTip')} value={formatMoney(trip.tipPiastres, locale)} />
            <Stat label={t('trips.tripDuration')} value={`${duration}m`} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('trips.tripKm')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
                <KV label={t('trips.tripKm')} value={`${formatKm(trip.totalKmMeters, locale)} ${t('common.km')}`} />
                <KV label={t('trips.tripPaidKm')} value={`${formatKm(trip.paidKmMeters, locale)} ${t('common.km')}`} />
                <KV label={t('trips.tripEmptyKm')} value={`${formatKm(trip.emptyKmMeters, locale)} ${t('common.km')}`} />
              </div>
            </CardContent>
          </Card>

          {trip.pickup || trip.destination || trip.paymentMethod || trip.waitingFeePiastres != null ? <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
              {trip.pickup ? <KV label={t('trips.ocr.fieldPickup')} value={trip.pickup} /> : null}
              {trip.destination ? <KV label={t('trips.ocr.fieldDestination')} value={trip.destination} /> : null}
              <KV label={t('trips.ocr.fieldPayment')} value={t(paymentLabelKey)} />
              {trip.waitingFeePiastres != null ? <KV label={t('trips.ocr.waitingFee')} value={formatMoney(trip.waitingFeePiastres, locale)} /> : null}
            </CardContent>
          </Card> : null}

          {trip.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('trips.tripNotes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="min-w-0 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm text-muted-foreground">
                  {trip.notes}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <div>
            <Link to="/trips" className="text-sm text-muted-foreground hover:text-foreground">
              ← {t('trips.back')}
            </Link>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="p-5 sm:p-6">
            <TripForm trip={trip} onDone={() => setEditing(false)} onClose={() => setEditing(false)} />
          </CardContent>
        </Card>
      )}

      {statusTarget ? <TripStatusDialog record={statusTarget} onClose={() => setStatusTarget(null)} onSaved={statusSaved} /> : null}
      {historyOpen ? <TripHistory record={trip} onClose={() => setHistoryOpen(false)} /> : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border/60 bg-card p-3">
      <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num-tabular mt-1 break-words text-base font-semibold">{value}</p>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-muted-foreground">{label}</p>
      <p className="num-tabular break-words font-semibold">{value}</p>
    </div>
  );
}
