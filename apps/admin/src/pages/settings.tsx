import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Settings as SettingsIcon } from 'lucide-react';
import { settingsApi } from '@/lib/api/endpoints';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Can } from '@/components/auth/can';
import { useI18n } from '@/i18n/provider';
import { toast } from '@/components/ui/toast';
import { readApiError } from '@/lib/api-error';

interface Setting {
  key: string;
  description: string | null;
  value: unknown;
  isDefault?: boolean;
  updatedAt: string | null;
  updatedById: string | null;
}

export function SettingsPage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('settings.title')} description={t('settings.subtitle')} />
      <SettingsList />
    </div>
  );
}

function SettingsList() {
  const { data, isLoading, error } = useQuery<Setting[]>({
    queryKey: ['admin', 'settings'],
    queryFn: () => settingsApi.list(),
  });

  if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>;
  if (error) return <div className="rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">Failed to load settings.</div>;

  return (
    <div className="space-y-3">
      {data?.map((s) => <SettingRow key={s.key} setting={s} />)}
    </div>
  );
}

function SettingRow({ setting }: { setting: Setting }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const initial = String(setting.value);
  const [value, setValue] = useState(initial);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setValue(initial);
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setting.key, initial]);

  const save = useMutation({
    mutationFn: () => {
      // Coerce: try to keep the original type (boolean / number / string / json).
      let parsed: unknown = value;
      if (typeof setting.value === 'boolean') parsed = value === 'true';
      else if (typeof setting.value === 'number') parsed = Number(value);
      else if (typeof setting.value === 'object' && setting.value !== null) {
        try {
          parsed = JSON.parse(value);
        } catch {
          throw new Error('Invalid JSON');
        }
      }
      return settingsApi.update(setting.key, parsed);
    },
    onSuccess: () => {
      toast.success(t('settings.saved'));
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      setDirty(false);
    },
    onError: (e) => {
      const er = readApiError(e);
      toast.error(er.code, er.message);
    },
  });

  const isBoolean = typeof setting.value === 'boolean';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <SettingsIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <code className="break-all font-mono text-sm">{setting.key}</code>
          {setting.isDefault && <Badge variant="muted">{t('settings.notSet')}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">{setting.description}</p>
        {isBoolean ? (
          <div className="flex items-center gap-2">
            {(['true', 'false'] as const).map((v) => (
              <button
                key={v}
                onClick={() => { setValue(v); setDirty(v !== initial); }}
                className={`rounded-md border px-3 py-1 text-sm transition-colors ${
                  value === v ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-muted/40 text-muted-foreground hover:bg-muted'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        ) : (
          <Input
            value={value}
            onChange={(e) => { setValue(e.target.value); setDirty(e.target.value !== initial); }}
            className="font-mono"
          />
        )}
        {dirty && (
          <div className="mt-3 flex justify-end">
            <Can permission="settings.update">
              <Button size="sm" onClick={() => save.mutate()} loading={save.isPending}>
                <Save className="h-3.5 w-3.5" />
                {t('common.save')}
              </Button>
            </Can>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
