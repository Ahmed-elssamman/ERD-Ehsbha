import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Phone, Mail, Calendar, Save } from 'lucide-react';
import { supportApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { TicketStatusBadge } from '@/components/ui/status-badge';
import { Can } from '@/components/auth/can';
import { toast } from '@/components/ui/toast';
import { readApiError } from '@/lib/api-error';
import { useI18n } from '@/i18n/provider';

const NEXT_STATUSES = ['OPEN', 'IN_REVIEW', 'PLANNED', 'RESOLVED', 'CLOSED'] as const;
type TicketStatus = (typeof NEXT_STATUSES)[number];

export function SupportDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'ticket', id],
    queryFn: () => supportApi.get(id),
    enabled: Boolean(id),
  });

  const [note, setNote] = useState('');

  const transition = useMutation({
    mutationFn: (status: TicketStatus) => supportApi.transition(id, status),
    onSuccess: () => {
      toast.success('Status updated');
      qc.invalidateQueries({ queryKey: ['admin', 'ticket', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'support'] });
    },
    onError: (e) => { const er = readApiError(e); toast.error(er.code, er.message); },
  });

  const saveNote = useMutation({
    mutationFn: () => supportApi.note(id, note),
    onSuccess: () => {
      toast.success('Note saved');
      setNote('');
      qc.invalidateQueries({ queryKey: ['admin', 'ticket', id] });
    },
    onError: (e) => { const er = readApiError(e); toast.error(er.code, er.message); },
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
        Failed to load ticket. <Link to="/support" className="text-primary underline">Back</Link>
      </div>
    );
  }

  const ticket = data as {
    id: string;
    subject: string;
    body: string;
    category: string;
    status: TicketStatus;
    adminNote: string | null;
    createdAt: string;
    updatedAt: string;
    user: { id: string; phone: string; email: string | null; status: string };
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/support')} className="mb-4">
        <ArrowLeft className="h-4 w-4" /> {t('support.backToTickets')}
      </Button>

      <PageHeader
        title={ticket.subject}
        description={`#${ticket.id.slice(-8)} · ${new Date(ticket.createdAt).toLocaleDateString()}`}
        actions={
          <>
            <Badge variant="outline">{ticket.category.replace(/_/g, ' ')}</Badge>
            <TicketStatusBadge status={ticket.status} />
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>{t('support.originalMessage')}</CardTitle></CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap break-words text-sm">{ticket.body}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('support.from')}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Link to={`/users/${ticket.user.id}`} className="break-all font-mono text-primary hover:underline">{ticket.user.phone}</Link>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="break-all">{ticket.user.email ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span>{t('common.updatedAt')}: {new Date(ticket.updatedAt).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>{t('support.internalNote')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {ticket.adminNote && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">{t('support.currentNote')}</div>
                <p className="whitespace-pre-wrap break-words">{ticket.adminNote}</p>
              </div>
            )}
            <Can permission="support.reply">
              <Textarea
                placeholder={t('support.addNotePlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <div className="flex justify-end">
                <Button onClick={() => saveNote.mutate()} loading={saveNote.isPending} disabled={!note.trim()} size="sm">
                  <Save className="h-3.5 w-3.5" /> {t('support.saveNote')}
                </Button>
              </div>
            </Can>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t('support.transition')}</CardTitle></CardHeader>
          <CardContent className="space-y-1.5">
            <Can permission="support.transition">
              {NEXT_STATUSES.filter((s) => s !== ticket.status).map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => transition.mutate(s)}
                  loading={transition.isPending}
                >
                  → {s.replace('_', ' ')}
                </Button>
              ))}
            </Can>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
