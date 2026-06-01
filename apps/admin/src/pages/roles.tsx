import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, Users as UsersIcon, Pencil, Trash2, UserPlus, Save } from 'lucide-react';
import { rolesApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Can } from '@/components/auth/can';
import { useI18n } from '@/i18n/provider';
import { toast } from '@/components/ui/toast';
import { readApiError } from '@/lib/api-error';
import { useAdminAuth } from '@/stores/admin-auth.store';

interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  userCount: number;
  permissions: string[];
}

interface Admin {
  id: string;
  email: string;
  displayName: string;
  isActive: boolean;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  roles: string[];
}

interface Permission {
  id: number;
  scope: string;
  action: string;
  description: string | null;
}

export function RolesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const session = useAdminAuth((s) => s.session);

  const { data: roles, isLoading: l1 } = useQuery<Role[]>({ queryKey: ['admin', 'roles'], queryFn: rolesApi.roles });
  const { data: admins, isLoading: l2 } = useQuery<Admin[]>({ queryKey: ['admin', 'admins'], queryFn: rolesApi.admins });
  const { data: permissions } = useQuery<Permission[]>({ queryKey: ['admin', 'permissions'], queryFn: rolesApi.permissions });

  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editingPerms, setEditingPerms] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Admin | null>(null);

  const saveRole = useMutation({
    mutationFn: () => rolesApi.updateRolePermissions(editingRole!.id, Array.from(editingPerms)),
    onSuccess: () => {
      toast.success(t('roles.roleSaved'));
      qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setEditingRole(null);
    },
    onError: (e) => { const er = readApiError(e); toast.error(er.code, er.message); },
  });

  const deleteAdmin = useMutation({
    mutationFn: (id: string) => rolesApi.deleteAdmin(id),
    onSuccess: () => {
      toast.success(t('roles.adminDeleted'));
      qc.invalidateQueries({ queryKey: ['admin', 'admins'] });
      qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setDeleteTarget(null);
    },
    onError: (e) => { const er = readApiError(e); toast.error(er.code, er.message); },
  });

  function openEdit(role: Role) {
    setEditingRole(role);
    setEditingPerms(new Set(role.permissions));
  }

  function togglePerm(code: string) {
    setEditingPerms((cur) => {
      const next = new Set(cur);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const permsByScope = new Map<string, Permission[]>();
  (permissions ?? []).forEach((p) => {
    const arr = permsByScope.get(p.scope) ?? [];
    arr.push(p);
    permsByScope.set(p.scope, arr);
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <PageHeader
        title={t('roles.title')}
        description={t('roles.subtitle')}
        actions={
          <Can permission="roles.manage">
            <Button onClick={() => setCreateOpen(true)} size="sm">
              <UserPlus className="h-3.5 w-3.5" />
              {t('roles.createAdmin')}
            </Button>
          </Can>
        }
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('roles.rolesHeading')}</h2>
        {l1 ? (
          <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {roles?.map((r) => (
              <Card key={r.id}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-2 truncate"><Shield className="h-4 w-4 shrink-0" /> {r.name}</span>
                    <div className="flex items-center gap-1.5">
                      {r.isSystem && <Badge variant="muted">{t('roles.system')}</Badge>}
                      {r.code !== 'super_admin' && (
                        <Can permission="roles.manage">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label={t('roles.editPerms')}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </Can>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                  <div className="flex items-center gap-3 text-xs">
                    <span><b>{r.permissionCount}</b> {t('roles.permissionsCount')}</span>
                    <span><UsersIcon className="inline h-3 w-3" /> <b>{r.userCount}</b> {t('roles.adminsCount')}</span>
                  </div>
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">{t('roles.showPerms')}</summary>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {r.permissions.map((p) => (
                        <span key={p} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">{p}</span>
                      ))}
                    </div>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{t('roles.adminsHeading')}</h2>
        {l2 ? <Skeleton className="h-32 w-full" /> : (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">{t('common.name')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('common.roles')}</th>
                  <th className="px-4 py-2.5 text-center font-medium">{t('roles.mfa')}</th>
                  <th className="px-4 py-2.5 text-center font-medium">{t('common.status')}</th>
                  <th className="px-4 py-2.5 text-start font-medium">{t('roles.lastLogin')}</th>
                  <th className="px-4 py-2.5 text-center font-medium">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {admins?.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{a.displayName}</div>
                      <div className="text-xs text-muted-foreground break-all">{a.email}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {a.roles.map((r) => <Badge key={r} variant="outline">{r}</Badge>)}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">{a.mfaEnabled ? <Badge variant="success">{t('common.yes')}</Badge> : <Badge variant="muted">{t('common.no')}</Badge>}</td>
                    <td className="px-4 py-2.5 text-center">{a.isActive ? <Badge variant="success">{t('community.visible')}</Badge> : <Badge variant="muted">{t('roles.disabled')}</Badge>}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : t('drivers.never')}</td>
                    <td className="px-4 py-2.5 text-center">
                      <Can permission="roles.manage">
                        {a.id !== session?.admin.id && (
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(a)} aria-label={t('common.delete')}>
                            <Trash2 className="h-3.5 w-3.5 text-danger" />
                          </Button>
                        )}
                      </Can>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={editingRole !== null} onOpenChange={(o) => !o && setEditingRole(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingRole?.name}</DialogTitle>
            <DialogDescription>{t('roles.permsCatalog')}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 border-b pb-2">
            <Button size="sm" variant="outline" onClick={() => setEditingPerms(new Set((permissions ?? []).map((p) => `${p.scope}.${p.action}`)))}>
              {t('roles.selectAll')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingPerms(new Set())}>{t('roles.selectNone')}</Button>
            <div className="ms-auto text-xs text-muted-foreground">{editingPerms.size} / {permissions?.length ?? 0}</div>
          </div>
          <div className="max-h-[50vh] space-y-3 overflow-y-auto">
            {Array.from(permsByScope.entries()).map(([scope, perms]) => (
              <div key={scope}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{scope}</div>
                <div className="flex flex-wrap gap-1.5">
                  {perms.map((p) => {
                    const code = `${p.scope}.${p.action}`;
                    const on = editingPerms.has(code);
                    return (
                      <button
                        key={code}
                        onClick={() => togglePerm(code)}
                        className={`rounded border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                          on ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-muted/40 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {code}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingRole(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => saveRole.mutate()} loading={saveRole.isPending}>
              <Save className="h-3.5 w-3.5" />
              {t('roles.saveRole')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateAdminDialog open={createOpen} onClose={() => setCreateOpen(false)} roles={roles ?? []} />

      <Dialog open={deleteTarget !== null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('roles.deleteAdmin')}</DialogTitle>
            <DialogDescription>{t('roles.deleteAdminConfirm')}</DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{deleteTarget.displayName}</div>
              <div className="text-xs text-muted-foreground break-all">{deleteTarget.email}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              loading={deleteAdmin.isPending}
              onClick={() => deleteTarget && deleteAdmin.mutate(deleteTarget.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateAdminDialog({ open, onClose, roles }: { open: boolean; onClose: () => void; roles: Role[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roleCodes, setRoleCodes] = useState<Set<string>>(new Set());

  const create = useMutation({
    mutationFn: () => rolesApi.createAdmin({ email, password, displayName, roleCodes: Array.from(roleCodes) }),
    onSuccess: () => {
      toast.success(t('roles.adminCreated'));
      qc.invalidateQueries({ queryKey: ['admin', 'admins'] });
      qc.invalidateQueries({ queryKey: ['admin', 'roles'] });
      setEmail('');
      setPassword('');
      setDisplayName('');
      setRoleCodes(new Set());
      onClose();
    },
    onError: (e) => { const er = readApiError(e); toast.error(er.code, er.message); },
  });

  const canSubmit = email.length > 3 && password.length >= 8 && displayName.length >= 1 && roleCodes.size > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('roles.newAdmin')}</DialogTitle>
          <DialogDescription>{t('roles.newAdminDesc')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('common.name')}</label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Jane Admin" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('common.email')}</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@ehsbha.com" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('roles.password')}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('roles.selectRoles')}</label>
            <div className="flex flex-wrap gap-1.5">
              {roles.map((r) => {
                const on = roleCodes.has(r.code);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRoleCodes((s) => { const n = new Set(s); if (n.has(r.code)) n.delete(r.code); else n.add(r.code); return n; })}
                    className={`rounded-md border px-2 py-1 text-xs transition-colors ${on ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-muted/40 text-muted-foreground hover:bg-muted'}`}
                  >
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={!canSubmit} loading={create.isPending} onClick={() => create.mutate()}>
            <UserPlus className="h-3.5 w-3.5" />
            {t('common.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
