import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';
import { EmptyState } from './empty-state';
import { Button } from './button';
import { Checkbox } from './checkbox';
import { useI18n } from '@/i18n/provider';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  sortable?: boolean;
  /** Function to extract sortable value from row. If omitted, sort is disabled for this column. */
  sortValue?: (row: T) => string | number | Date | null | undefined;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  isLoading?: boolean;
  error?: unknown;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Default rows per page. Defaults to 10. */
  pageSize?: number;
  /** When true, renders a leading checkbox column and a header "select-all" checkbox. */
  selectable?: boolean;
  /** Controlled selected ids. */
  selectedIds?: string[];
  /** Called whenever the selection set changes. */
  onSelectionChange?: (ids: string[]) => void;
}

type SortDir = 'asc' | 'desc' | null;

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  error,
  onRowClick,
  rowKey,
  emptyTitle,
  emptyDescription,
  pageSize = 10,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: DataTableProps<T>) {
  const { t } = useI18n();
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);
  const [internalSelected, setInternalSelected] = useState<Set<string>>(new Set());
  const selection = selectedIds != null ? new Set(selectedIds) : internalSelected;

  function setSelection(next: Set<string>) {
    if (selectedIds != null) {
      onSelectionChange?.(Array.from(next));
    } else {
      setInternalSelected(next);
      onSelectionChange?.(Array.from(next));
    }
  }

  const sorted = useMemo(() => {
    if (!rows) return rows;
    if (!sortKey || !sortDir) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const fn = col.sortValue;
    const arr = [...rows];
    arr.sort((a, b) => {
      const av = fn(a);
      const bv = fn(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, sortDir, columns]);

  const total = sorted?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(
    () => sorted?.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  // Reset to page 1 whenever the underlying rows or sort change to avoid out-of-range pages.
  useEffect(() => {
    if (page !== 1 && (page - 1) * pageSize >= total) setPage(1);
  }, [total, page, pageSize]);

  const pagedIds = paged?.map((r) => rowKey(r)) ?? [];
  const allOnPageSelected = pagedIds.length > 0 && pagedIds.every((id) => selection.has(id));
  const someOnPageSelected = !allOnPageSelected && pagedIds.some((id) => selection.has(id));

  function togglePageSelection(check: boolean) {
    const next = new Set(selection);
    for (const id of pagedIds) {
      if (check) next.add(id);
      else next.delete(id);
    }
    setSelection(next);
  }

  function toggleRow(id: string) {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  }

  function toggleSort(col: Column<T>) {
    if (!col.sortValue) return;
    if (sortKey !== col.key) {
      setSortKey(col.key);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    setSortKey(null);
    setSortDir(null);
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allOnPageSelected}
                    indeterminate={someOnPageSelected}
                    onChange={(e) => togglePageSelection(e.currentTarget.checked)}
                    aria-label="Select all rows on this page"
                  />
                </th>
              )}
              {columns.map((c) => {
                const sortable = !!c.sortValue;
                const active = sortKey === c.key;
                const Icon = active ? (sortDir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown;
                return (
                  <th
                    key={c.key}
                    onClick={() => sortable && toggleSort(c)}
                    className={cn(
                      'select-none px-4 py-2.5 font-medium',
                      c.align === 'right' && 'text-right',
                      c.align === 'center' && 'text-center',
                      (c.align === undefined || c.align === 'left') && 'text-left',
                      sortable && 'cursor-pointer hover:text-foreground',
                      c.className,
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {c.header}
                      {sortable && <Icon className={cn('h-3 w-3', active ? 'text-foreground' : 'opacity-50')} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <>
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {selectable && <td className="px-3 py-3"><Skeleton className="h-4 w-4" /></td>}
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3">
                        <Skeleton className="h-4 w-24" />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            )}
            {!isLoading && Boolean(error) && (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-4 py-12 text-center text-danger">
                  {t('common.error')}
                </td>
              </tr>
            )}
            {!isLoading && !error && paged && paged.length === 0 && (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} className="px-0 py-0">
                  <EmptyState title={emptyTitle ?? t('common.empty')} description={emptyDescription} />
                </td>
              </tr>
            )}
            {!isLoading &&
              !error &&
              paged?.map((row, i) => {
                const id = rowKey(row);
                const isSelected = selection.has(id);
                return (
                  <motion.tr
                    key={id}
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, delay: Math.min(i * 0.012, 0.15) }}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-b last:border-0 transition-colors',
                      isSelected && 'bg-primary/5',
                      onRowClick && 'cursor-pointer hover:bg-muted/30',
                      !onRowClick && selectable && 'hover:bg-muted/20',
                    )}
                  >
                    {selectable && (
                      <td className="w-10 px-3 py-2.5 align-top">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleRow(id)}
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          'px-4 py-2.5 align-top',
                          c.align === 'right' && 'text-right',
                          c.align === 'center' && 'text-center',
                          c.className,
                        )}
                      >
                        <div className="min-w-0 break-words">{c.cell(row)}</div>
                      </td>
                    ))}
                  </motion.tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {total > pageSize && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div>
            {t('common.showing')} {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, total)} {t('common.of')} {total} {t('common.rows')}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label={t('common.previous')}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t('common.previous')}
            </Button>
            <span className="px-2">
              {t('common.page')} {safePage} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              aria-label={t('common.next')}
            >
              {t('common.next')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
