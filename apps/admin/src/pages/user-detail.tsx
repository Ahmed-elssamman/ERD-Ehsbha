import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Ban, ShieldCheck, Phone, Mail, Calendar, Car } from 'lucide-react';
import { usersApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserStatusBadge } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Can } from '@/components/auth/can';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { readApiError } from '@/lib/api-error';
import { useI18n } from '@/i18n/provider';
import { formatNumber } from '@/lib/utils';

type Action = 'suspend' | 'activate';

export function UserDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () => usersApi.get(id),
    enabled: Boolean(id),
  });

  const [dialog, setDialog] = useState<{ action: Action; reason: string } | null>(null);

  const mutation = useMutation({
    mutationFn: async ({ action, reason }: { action: Action; reason: string }) => {
      const reasonCode = 'OTHER';
      return action === 'suspend'
        ? usersApi.suspend(id, reason, reasonCode)
        : usersApi.activate(id, reason, reasonCode);
    },
    onSuccess: (_, vars) => {
      toast.success(vars.action === 'suspend' ? 'User suspended' : 'User activated');
      setDialog(null);
      qc.invalidateQueries({ queryKey: ['admin', 'user', id] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => {
      const e = readApiError(err);
      toast.error(e.code, e.message);
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center text-danger">
        Failed to load user. <Link to="/users" className="text-primary underline">Back to list</Link>
      </div>
    );
  }

  const u = data;

  return (
    <div className="mx-auto max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate('/users')} className="mb-4">
        <ArrowLeft className="h-4 w-4" />
        {t('users.backToUsers')}
      </Button>

      <PageHeader
        title={u.driver?.displayName ?? u.phone}
        description={`User #${u.id}`}
        actions={
          <>
            <UserStatusBadge status={u.status} />
            {u.status === 'ACTIVE' ? (
              <Can permission="users.suspend">
                <Button variant="warning" size="sm" onClick={() => setDialog({ action: 'suspend', reason: '' })}>
                  <Ban className="h-3.5 w-3.5" />
                  {t('users.suspend')}
                </Button>
              </Can>
            ) : (
              <Can permission="users.activate">
                <Button variant="success" size="sm" onClick={() => setDialog({ action: 'activate', reason: '' })}>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t('users.activate')}
                </Button>
              </Can>
            )}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('users.identity')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono">{u.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{u.email ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Joined {new Date(u.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Badge variant="outline">{u.locale}</Badge>
              <Badge variant="outline">{u.timezone}</Badge>
            </div>
          </CardContent>
        </Card>

        {u.driver && (
          <Card>
            <CardHeader>
              <CardTitle>{t('users.driverProfile')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Display name:</span> {u.driver.displayName}
              </div>
              <div>
                <span className="text-muted-foreground">Base city:</span> {u.driver.baseCity ?? '—'}
              </div>
              <Link to={`/drivers/${u.driver.id}`} className="inline-flex items-center text-primary hover:underline">
                Open driver profile →
              </Link>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t('users.activity')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {u.driver ? (
              <>
                <div className="flex justify-between"><span>Trips</span><span className="font-medium">{formatNumber(u.driver._count.trips)}</span></div>
                <div className="flex justify-between"><span>Fuel logs</span><span className="font-medium">{formatNumber(u.driver._count.fuelLogs)}</span></div>
                <div className="flex justify-between"><span>Expenses</span><span className="font-medium">{formatNumber(u.driver._count.expenses)}</span></div>
                <div className="flex justify-between"><span>Maintenance</span><span className="font-medium">{formatNumber(u.driver._count.maintenanceRecords)}</span></div>
              </>
            ) : (
              <p className="text-muted-foreground">No driver profile.</p>
            )}
            <div className="flex justify-between border-t pt-2 mt-2"><span>Tickets</span><span className="font-medium">{u._count.supportTickets}</span></div>
            <div className="flex justify-between"><span>Devices</span><span className="font-medium">{u._count.deviceTokens}</span></div>
          </CardContent>
        </Card>
      </div>

      {u.driver && (u.driver.vehicles.length > 0 || u.driver.driverApps.length > 0) && (
        <div className="grid gap-4 mt-4 md:grid-cols-2">
          {u.driver.vehicles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active vehicles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {u.driver.vehicles.map((v) => (
                  <div key={v.id} className="flex items-center gap-2">
                    <Car className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>
                      {v.type} — {[v.make, v.model, v.year].filter(Boolean).join(' ')}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {u.driver.driverApps.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Connected apps</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-1.5">
                {u.driver.driverApps.map((a) => (
                  <Badge key={a.id} variant="outline">{a.appSource.name} · {Number(a.commissionPct).toFixed(0)}%</Badge>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog?.action === 'suspend' ? t('users.suspendUser') : t('users.activateUser')}</DialogTitle>
            <DialogDescription>
              {dialog?.action === 'suspend' ? t('users.suspendDesc') : t('users.activateDesc')}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={t('common.reasonPlaceholder')}
            value={dialog?.reason ?? ''}
            onChange={(e) => setDialog((d) => (d ? { ...d, reason: e.target.value } : d))}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant={dialog?.action === 'suspend' ? 'warning' : 'success'}
              loading={mutation.isPending}
              disabled={(dialog?.reason.length ?? 0) < 3}
              onClick={() => dialog && mutation.mutate({ action: dialog.action, reason: dialog.reason })}
            >
              {dialog?.action === 'suspend' ? 'Suspend' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
