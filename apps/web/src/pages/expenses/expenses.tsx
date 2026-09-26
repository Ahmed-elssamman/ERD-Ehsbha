import { RecordDraftList } from '@/components/record-drafts/record-draft-list';
import { RecordDraftKind } from '@/lib/record-drafts/record-draft.model';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt } from 'lucide-react';
import { ExpenseView } from '@ehsbha/shared-types';
import { useI18n } from '@/i18n';
import { ExpensesApi, type Expense } from '@/lib/api/endpoints';
import { formatDate, formatMoney } from '@/lib/format';
import { useBusinessDate } from '@/hooks/use-business-date';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ExpenseDialog, ResumeExpenseDraft } from './expense-dialog';
import { ExpenseHistory } from './expense-history';
import { ExpenseStatusDialog } from './expense-status-dialog';
import { EXPENSE_VIEWS, EXPENSE_INVALIDATIONS, EXPENSE_DATE_FORMAT, expenseMonthRange } from './expenses.control';

export function ExpensesPage() {
  const { t, locale } = useI18n();
  const queryClient = useQueryClient();
  const today = useBusinessDate();
  const [selectedMonth, setSelectedMonth] = useState('');
  const month = selectedMonth || today.slice(0, 7);
  const [view, setView] = useState(ExpenseView.Active);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [statusExpense, setStatusExpense] = useState<Expense | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const range = expenseMonthRange(month);
  const summary = useQuery({ queryKey: ['expenses', 'summary', month], enabled: range !== null,
    queryFn: () => ExpensesApi.summary({ from: range?.from ?? today, to: range?.to ?? today }), staleTime: 30_000 });
  const list = useInfiniteQuery({ queryKey: ['expenses', 'list', month, view], enabled: range !== null, initialPageParam: '',
    queryFn: ({ pageParam }) => ExpensesApi.list({ from: range?.since, to: range?.until, view, ...(pageParam ? { cursor: pageParam } : {}) }),
    getNextPageParam: (page) => page.nextCursor, staleTime: 30_000 });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  function changeMonth(value: string) { if (expenseMonthRange(value)) { setSelectedMonth(value); setSaved(false); } }
  function openCreate() { setCreating(true); setSaved(false); }
  function refresh() { void summary.refetch(); void list.refetch(); }
  function closeEditor() { setCreating(false); setEditing(null); }
  function onSaved() {
    for (const key of EXPENSE_INVALIDATIONS) void queryClient.invalidateQueries({ queryKey: [key] });
    closeEditor(); setStatusExpense(null); setSaved(true);
  }
  return <div className="space-y-6 animate-fade-in">
    <PageHeader title={t('expenses.title')} subtitle={t('expenses.subtitle')}
      actions={<Button className="min-h-11 gap-2" onClick={openCreate}><Plus className="h-4 w-4" aria-hidden />{t('expenses.add')}</Button>} />
    <div className="flex flex-wrap items-end gap-3">
      <div className="max-w-xs space-y-1.5"><Label htmlFor="expense-month">{t('expenses.month')}</Label>
        <Input id="expense-month" className="min-h-11" type="month" min="1900-01" max="9998-12" value={month} onChange={(event) => changeMonth(event.target.value)} /></div>
      <Button className="min-h-11" variant="outline" onClick={refresh} loading={summary.isFetching || list.isFetching}>{t('expenses.refresh')}</Button>
    </div>
    {!creating && !editing ? <RecordDraftList kind={RecordDraftKind.Expense} render={(draft, close) => <ResumeExpenseDraft draft={draft} onClose={close} onSaved={() => { close(); onSaved(); }} />} /> : null}
    {saved ? <p role="status" className="text-sm text-primary">{t('expenses.saved')}</p> : null}
    <Card><CardHeader><CardTitle className="text-base">{t('expenses.totalMonth')}</CardTitle></CardHeader><CardContent className="space-y-4">
      {summary.isLoading ? <Skeleton className="h-10 w-40" /> : null}
      {summary.isError ? <div role="alert" className="space-y-2"><p>{t('expenses.summaryFailed')}</p><Button variant="outline" className="min-h-11" onClick={() => void summary.refetch()}>{t('common.retry')}</Button></div> : null}
      {summary.data && !summary.isError ? <>
        <p className="num-tabular text-3xl font-bold tracking-tight" data-testid="expense-month-total">{formatMoney(summary.data.totalPiastres, locale)}</p>
        <p className="text-sm">{t('expenses.summaryCount', { count: summary.data.recordCount, linked: summary.data.linkedCount })}</p>
        <div><h2 className="mb-2 text-sm font-semibold">{t('expenses.byCategory')}</h2>
          <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">{summary.data.byCategory.map((row) => <li key={row.category} className="flex justify-between gap-2">
            <span>{t(`expenses.category.${row.category}`)}</span><span className="num-tabular">{formatMoney(row.amountPiastres, locale)}</span>
          </li>)}</ul>
        </div>
      </> : null}
      <p className="text-sm text-muted-foreground">{t('expenses.summaryHint')}</p>
    </CardContent></Card>
    <div role="group" aria-label={t('expenses.view.label')} className="flex flex-wrap gap-2">
      {EXPENSE_VIEWS.map((option) => <Button key={option} className="min-h-11" variant={option === view ? 'default' : 'outline'} aria-pressed={option === view} onClick={() => setView(option)}>{t(`expenses.view.${option}`)}</Button>)}
    </div>
    <Card><CardContent className="p-0">
      {list.isLoading ? <div className="p-5"><Skeleton className="h-24 w-full" /></div> : null}
      {list.isError ? <div role="alert" className="space-y-3 p-5"><p>{t('expenses.listFailed')}</p><Button variant="outline" className="min-h-11" onClick={() => void list.refetch()}>{t('common.retry')}</Button></div> : null}
      {list.isSuccess && items.length === 0 ? <EmptyState Icon={Receipt} title={t(view === ExpenseView.Deleted ? 'expenses.deletedEmpty' : 'expenses.empty')}
        body={t(view === ExpenseView.Deleted ? 'expenses.deletedEmptyBody' : 'expenses.emptyBody')}
        action={view === ExpenseView.Active ? <Button className="min-h-11" onClick={openCreate}>{t('expenses.add')}</Button> : null} /> : null}
      <ul className="divide-y divide-border/60">{items.map((expense) => <li key={expense.id} className="space-y-2 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-2"><span className="font-semibold">{t(`expenses.category.${expense.category}`)}</span>
          <span className="num-tabular font-semibold">{formatMoney(expense.amountPiastres, locale)}</span></div>
        <p className="text-sm text-muted-foreground">{formatDate(expense.dateTime, locale, EXPENSE_DATE_FORMAT)}</p>
        {expense.notes ? <p className="break-words text-sm">{expense.notes}</p> : null}
        <div className="flex flex-wrap gap-2">
          {expense.isRecurring ? <Badge variant="muted">{t('expenses.field.recurring')}</Badge> : null}
          {expense.linkedFuel?.length ? <Button asChild variant="link"><Link to="/fuel">{t('fuel.link.linked')}</Link></Button> : null}
          {expense.linkedMaintenance?.length ? <Button asChild variant="link"><Link to="/maintenance">{t('maintenance.link.linked')}</Link></Button> : null}
          {expense.linkedTripId ? <Badge variant="muted">{t('expenses.link.badge')}</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {view === ExpenseView.Active ? <Button className="min-h-11" variant="outline" onClick={() => setEditing(expense)}>{t('common.edit')}</Button> : null}
          <Button className="min-h-11" variant="ghost" onClick={() => setHistoryId(expense.id)}>{t('expenses.history.title')}</Button>
          <Button className="min-h-11" variant="ghost" onClick={() => setStatusExpense(expense)}>{t(view === ExpenseView.Deleted ? 'expenses.restore' : 'common.delete')}</Button>
        </div>
      </li>)}</ul>
      {list.hasNextPage ? <div className="p-4"><Button className="min-h-11 w-full" variant="outline" loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>{t('common.loadMore')}</Button></div> : null}
    </CardContent></Card>
    {creating || editing ? <ExpenseDialog expense={editing} onClose={closeEditor} onSaved={onSaved} /> : null}
    {statusExpense ? <ExpenseStatusDialog expense={statusExpense} onClose={() => setStatusExpense(null)} onSaved={onSaved} /> : null}
    {historyId ? <ExpenseHistory expenseId={historyId} onClose={() => setHistoryId(null)} /> : null}
  </div>;
}
