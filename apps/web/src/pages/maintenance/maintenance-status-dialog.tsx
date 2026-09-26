import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MaintenanceApi, type MaintenanceRecord } from '@/lib/api/endpoints';
import { generateIdempotencyKey } from '@/features/platform-api';
import { useI18n, useMaintenanceItemLabel } from '@/i18n';
import { formatMoney, formatDate } from '@/lib/format';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MAINTENANCE_DATE_FORMAT, maintenanceErrorKey } from './maintenance.control';

interface Props { record: MaintenanceRecord; onClose: () => void; onSaved: () => void }
export function MaintenanceStatusDialog({ record, onClose, onSaved }: Props) {
  const { t, locale } = useI18n();
  const itemLabel = useMaintenanceItemLabel();
  const [key] = useState(generateIdempotencyKey);
  const restoring = record.deletedAt !== null;
  const mutation = useMutation({ mutationFn: async () => {
    if (restoring) await MaintenanceApi.restoreRecord(record.vehicleId, record.id, record.version, key);
    else await MaintenanceApi.removeRecord(record.vehicleId, record.id, record.version, key);
  }, onSuccess: onSaved });
  function close() { if (!mutation.isPending) onClose(); }
  return <Dialog open onClose={close} title={t(restoring ? 'maintenance.restore' : 'common.confirmDelete')}
    footer={<><Button className="min-h-11" variant="ghost" onClick={close} disabled={mutation.isPending}>{t('common.cancel')}</Button>
      <Button className="min-h-11" variant={restoring ? 'default' : 'destructive'} onClick={() => mutation.mutate()} loading={mutation.isPending}>{t(restoring ? 'maintenance.restore' : 'common.delete')}</Button></>}>
    <div className="space-y-3"><p>{record.maintenanceItem ? itemLabel(record.maintenanceItem) : t('maintenance.record')} · {formatMoney(record.costPiastres, locale)}</p>
      <p>{formatDate(record.performedAt, locale, MAINTENANCE_DATE_FORMAT)}</p>
      <p>{t(restoring ? 'maintenance.restoreHint' : 'maintenance.deleteHint')}</p>
      {record.linkedExpenseId ? <p>{t('maintenance.link.deleteHint')}</p> : null}
      {mutation.error ? <p role="alert" className="text-destructive">{t(maintenanceErrorKey(mutation.error))}</p> : null}</div>
  </Dialog>;
}
