import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import { PageHeader } from '@/components/ui/page-header';
import { useI18n } from '@/i18n';
import { TripsApi } from '@/lib/api/endpoints';
import { formatDate, formatKm, formatMoney, formatTime } from '@/lib/format';
import { durationMinutes } from '@/lib/time';
import { TripForm } from './trip-form';

export function TripDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const { data: trip, isLoading } = useQuery({
    queryKey: ['trip', id],
    queryFn: () => TripsApi.get(id),
    enabled: !!id,
  });

  const removeMut = useMutation({
    mutationFn: () => TripsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      qc.invalidateQueries({ queryKey: ['decisions'] });
      qc.invalidateQueries({ queryKey: ['score'] });
      navigate('/trips', { replace: true });
    },
  });

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
        <PageHeader title={t('errors.TRIP_NOT_FOUND')} />
        <Button onClick={() => navigate('/trips')} className="gap-2">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('trips.back')}
        </Button>
      </div>
    );
  }

  const net = trip.grossPiastres + trip.tipPiastres - trip.commissionPiastres;
  const duration = durationMinutes(trip.startedAt, trip.endedAt);

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
              <Button variant="outline" onClick={() => setEditing(true)} className="gap-2">
                <Edit2 className="h-4 w-4" aria-hidden />
                {t('common.edit')}
              </Button>
              <Button variant="destructive" onClick={() => setConfirm(true)} className="gap-2">
                <Trash2 className="h-4 w-4" aria-hidden />
                {t('common.delete')}
              </Button>
            </>
          )
        }
      />

      {!editing ? (
        <>
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
              <div className="grid grid-cols-3 gap-3 text-sm">
                <KV label={t('trips.tripKm')} value={`${formatKm(trip.totalKmMeters, locale)} km`} />
                <KV label={t('trips.tripPaidKm')} value={`${formatKm(trip.paidKmMeters, locale)} km`} />
                <KV label={t('trips.tripEmptyKm')} value={`${formatKm(trip.emptyKmMeters, locale)} km`} />
              </div>
            </CardContent>
          </Card>

          {trip.notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('trips.tripNotes')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{trip.notes}</p>
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
            <TripForm trip={trip} onDone={() => setEditing(false)} />
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => removeMut.mutate()}
        title={t('common.confirmDelete')}
        body={t('common.confirmDeleteBody')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={removeMut.isPending}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="num-tabular mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="num-tabular font-semibold">{value}</p>
    </div>
  );
}
