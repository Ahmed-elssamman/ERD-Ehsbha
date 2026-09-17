import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { readApiError } from '@/lib/api/client';
import { TripsApi, type TripItem } from '@/lib/api/endpoints';
import { generateIdempotencyKey } from '@/features/platform-api';
import { useI18n } from '@/i18n';
import { formatMoney, formatDate } from '@/lib/format';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { tripEarningsPiastres } from '@ehsbha/shared-types';
import { TRIP_HISTORY_DATE_FORMAT } from './trip-history.control';
import { tripStatusErrorKey } from './trip-draft.control';

interface Props { record: TripItem; onClose: () => void; onSaved: () => void }
export function TripStatusDialog({ record: initial, onClose, onSaved }: Props) {
  const [record] = useState(initial);
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();

  const [key] = useState(generateIdempotencyKey);
  const restoring = record.deletedAt !== null;
  const mutation = useMutation({ mutationFn: async () => {
    if (restoring) await TripsApi.restore(record.id, record.version, key);
    else await TripsApi.remove(record.id, record.version, key);
  }, onSuccess: onSaved, onError: (error) => {
    if (readApiError(error).code === 'TRIP_VERSION_CONFLICT') void queryClient.invalidateQueries({ queryKey: ['trip', record.id] });
  } });
  function close() { if (!mutation.isPending) onClose(); }
  return <Dialog open onClose={close} title={t(restoring ? 'trips.restore' : 'common.confirmDelete')}
    footer={<><Button className="min-h-11" variant="ghost" onClick={close} disabled={mutation.isPending}>{t('common.cancel')}</Button>
      <Button className="min-h-11" variant={restoring ? 'default' : 'destructive'} onClick={() => mutation.mutate()} loading={mutation.isPending}>{t(restoring ? 'trips.restore' : 'common.delete')}</Button></>}>
    <div className="space-y-3"><p>{formatMoney(tripEarningsPiastres(record), locale)}</p>
      <p>{formatDate(record.startedAt, locale, TRIP_HISTORY_DATE_FORMAT)}</p>
      <p>{t(restoring ? 'trips.restoreHint' : 'trips.deleteHint')}</p>

      {mutation.error ? <p role="alert" className="text-destructive">{t(tripStatusErrorKey(mutation.error))}</p> : null}</div>
  </Dialog>;
}
