import { useState, useEffect, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Textarea } from './textarea';
import { Button } from './button';
import { useI18n } from '@/i18n/provider';

interface BulkConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  count: number;
  confirmLabel: string;
  confirmVariant?: 'default' | 'danger' | 'warning' | 'success';
  loading?: boolean;
  onConfirm: (reason: string) => void;
  /** Optional extra content above the reason input. */
  children?: ReactNode;
}

export function BulkConfirmDialog({
  open,
  onClose,
  title,
  description,
  count,
  confirmLabel,
  confirmVariant = 'default',
  loading,
  onConfirm,
  children,
}: BulkConfirmDialogProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) setReason('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description ?? t('common.bulkConfirmReason')} · {count} {t('common.rows')}
          </DialogDescription>
        </DialogHeader>
        {children}
        <Textarea
          placeholder={t('common.reasonPlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant={confirmVariant}
            disabled={reason.length < 3}
            loading={loading}
            onClick={() => onConfirm(reason)}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
