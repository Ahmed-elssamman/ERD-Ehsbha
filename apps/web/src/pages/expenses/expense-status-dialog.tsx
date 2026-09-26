import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { ExpensesApi, type Expense } from '@/lib/api/endpoints';
import { generateIdempotencyKey } from '@/features/platform-api';
import { useI18n } from '@/i18n';
import { formatMoney, formatDate } from '@/lib/format';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EXPENSE_DATE_FORMAT, expenseErrorKey } from './expenses.control';

interface Props { expense: Expense; onClose: () => void; onSaved: () => void }

export function ExpenseStatusDialog({ expense, onClose, onSaved }: Props) {
  const { t, locale } = useI18n();
  const [key] = useState(generateIdempotencyKey);
  const restoring = expense.deletedAt !== null;
  const mutation = useMutation({ mutationFn: async () => {
    if (restoring) await ExpensesApi.restore(expense.id, expense.version, key);
    else await ExpensesApi.remove(expense.id, expense.version, key);
  }, onSuccess: onSaved });
  function close() { if (!mutation.isPending) onClose(); }
  function confirm() { mutation.mutate(); }
  return <Dialog open onClose={close} title={t(restoring ? 'expenses.restore' : 'common.confirmDelete')}
    footer={<><Button className="min-h-11" variant="ghost" onClick={close} disabled={mutation.isPending}>{t('common.cancel')}</Button>
      <Button className="min-h-11" variant={restoring ? 'default' : 'destructive'} onClick={confirm} loading={mutation.isPending}>{t(restoring ? 'expenses.restore' : 'common.delete')}</Button></>}>
    <div className="space-y-3">
      <p>{t(`expenses.category.${expense.category}`)} · {formatMoney(expense.amountPiastres, locale)}</p>
      <p className="text-sm">{formatDate(expense.dateTime, locale, EXPENSE_DATE_FORMAT)}</p>
      <p>{t(restoring ? 'expenses.restoreHint' : 'expenses.deleteHint')}</p>
      {expense.linkedTripId ? <p className="text-sm">{t('expenses.link.deleteHint')}</p> : null}
      {mutation.error ? <p role="alert" className="text-sm text-destructive">{t(expenseErrorKey(mutation.error))}</p> : null}
    </div>
  </Dialog>;
}
