import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FuelApi, type FuelEntry } from '@/lib/api/endpoints';
import { generateIdempotencyKey } from '@/features/platform-api';
import { useI18n } from '@/i18n';
import { formatMoney, formatDate } from '@/lib/format';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FUEL_DATE_FORMAT, fuelErrorKey } from './fuel.control';

interface Props { record: FuelEntry; onClose: () => void; onSaved: () => void }
export function FuelStatusDialog({ record, onClose, onSaved }: Props) {
  const { t, locale } = useI18n();

  const [key] = useState(generateIdempotencyKey);
  const restoring = record.deletedAt !== null;
  const mutation = useMutation({ mutationFn: async () => {
    if (restoring) await FuelApi.restore(record.id, record.version, key);
    else await FuelApi.remove(record.id, record.version, key);
  }, onSuccess: onSaved });
  function close() { if (!mutation.isPending) onClose(); }
  return <Dialog open onClose={close} title={t(restoring ? 'fuel.restore' : 'common.confirmDelete')}
    footer={<><Button className="min-h-11" variant="ghost" onClick={close} disabled={mutation.isPending}>{t('common.cancel')}</Button>
      <Button className="min-h-11" variant={restoring ? 'default' : 'destructive'} onClick={() => mutation.mutate()} loading={mutation.isPending}>{t(restoring ? 'fuel.restore' : 'common.delete')}</Button></>}>
    <div className="space-y-3"><p>{formatMoney(record.totalPiastres, locale)}</p>
      <p>{formatDate(record.dateTime, locale, FUEL_DATE_FORMAT)}</p>
      <p>{t(restoring ? 'fuel.restoreHint' : 'fuel.deleteHint')}</p>
      {record.linkedExpenseId ? <p>{t('fuel.link.deleteHint')}</p> : null}
      {mutation.error ? <p role="alert" className="text-destructive">{t(fuelErrorKey(mutation.error))}</p> : null}</div>
  </Dialog>;
}
