import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CommunityApi, type CommunityCategory } from '@/lib/api/endpoints';
import { readApiError } from '@/lib/api/client';
import { useT } from '@/i18n';
import { useState } from 'react';

const CATEGORIES: CommunityCategory[] = [
  'BEST_APPS',
  'EXPERIENCE_UBER',
  'EXPERIENCE_INDRIVE',
  'EXPERIENCE_DIDI',
  'EXPERIENCE_OTHER',
  'FUEL_SAVING',
  'BEST_HOURS',
  'MAINTENANCE_ADVICE',
  'EFFICIENCY_TIPS',
  'OPERATIONAL_MISTAKES',
  'WEEKLY_LESSON',
  'SAFETY_ADVICE',
  'GENERAL',
];

const schema = z.object({
  category: z.enum([
    'BEST_APPS',
    'EXPERIENCE_UBER',
    'EXPERIENCE_INDRIVE',
    'EXPERIENCE_DIDI',
    'EXPERIENCE_OTHER',
    'FUEL_SAVING',
    'BEST_HOURS',
    'MAINTENANCE_ADVICE',
    'EFFICIENCY_TIPS',
    'OPERATIONAL_MISTAKES',
    'WEEKLY_LESSON',
    'SAFETY_ADVICE',
    'GENERAL',
  ]),
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(10).max(2000),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  defaultCategory?: CommunityCategory;
}

export function PostComposer({ open, onClose, defaultCategory = 'GENERAL' }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { category: defaultCategory, title: '', body: '' },
    values: { category: defaultCategory, title: '', body: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      CommunityApi.create({ category: values.category, title: values.title, body: values.body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['community-posts'] });
      reset();
      setServerError(null);
      onClose();
    },
    onError: (err) => {
      const e = readApiError(err);
      const key = `errors.${e.code}`;
      const msg = t(key);
      setServerError(msg === key ? t('errors.UNKNOWN') : msg);
    },
  });

  const onSubmit = handleSubmit((values) => mutation.mutateAsync(values));

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (mutation.isPending || isSubmitting) return;
        reset();
        setServerError(null);
        onClose();
      }}
      title={t('community.shareYourTip')}
      description={t('community.shareYourTipBody')}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (mutation.isPending || isSubmitting) return;
              reset();
              setServerError(null);
              onClose();
            }}
            disabled={isSubmitting || mutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            form="post-composer-form"
            loading={isSubmitting || mutation.isPending}
          >
            {mutation.isPending ? t('community.publishing') : t('community.publish')}
          </Button>
        </>
      }
    >
      <form id="post-composer-form" className="space-y-4" onSubmit={onSubmit} noValidate>
        {serverError ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{serverError}</p>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="post-category">{t('community.field.category')}</Label>
          <Select id="post-category" invalid={!!errors.category} {...register('category')}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {t(`community.categories.${c}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="post-title">{t('community.field.title')}</Label>
          <Input
            id="post-title"
            placeholder={t('community.field.titlePlaceholder')}
            maxLength={120}
            invalid={!!errors.title}
            {...register('title')}
          />
          {errors.title ? (
            <p className="text-xs text-destructive">{t('community.errors.titleShort')}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="post-body">{t('community.field.body')}</Label>
          <Textarea
            id="post-body"
            rows={6}
            placeholder={t('community.field.bodyPlaceholder')}
            maxLength={2000}
            invalid={!!errors.body}
            {...register('body')}
          />
          {errors.body ? (
            <p className="text-xs text-destructive">{t('community.errors.bodyShort')}</p>
          ) : null}
        </div>
      </form>
    </Dialog>
  );
}
