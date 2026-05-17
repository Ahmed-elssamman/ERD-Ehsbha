import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, AlertCircle } from 'lucide-react';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useI18n } from '@/i18n';
import { AuthApi } from '@/lib/api/endpoints';
import { readApiError } from '@/lib/api/client';
import { useAuth } from '@/stores/auth.store';

const schema = z.object({
  displayName: z.string().min(2).max(80),
  phone: z.string().regex(/^\+?\d{8,15}$/),
  password: z.string().min(8).max(128),
});
type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const setSession = useAuth((s) => s.setSession);
  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { displayName: '', phone: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
      const result = await AuthApi.register({ ...values, locale, timezone });
      setSession(result);
      navigate('/', { replace: true });
    } catch (err) {
      const e = readApiError(err);
      const key = `errors.${e.code}`;
      const msg = t(key);
      setServerError(msg === key ? t('errors.UNKNOWN') : msg);
    }
  });

  return (
    <AuthLayout>
      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-2xl">{t('auth.createAccount')}</CardTitle>
          <CardDescription>{t('auth.registerSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {serverError ? (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
              >
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              </motion.div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="displayName">{t('auth.displayName')}</Label>
              <Input
                id="displayName"
                autoComplete="name"
                placeholder={t('auth.displayNamePlaceholder')}
                invalid={!!errors.displayName}
                {...register('displayName')}
              />
              {errors.displayName ? (
                <p className="text-xs text-destructive">{t('auth.displayNameTooShort')}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">{t('auth.phone')}</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder={t('auth.phonePlaceholder')}
                dir="ltr"
                invalid={!!errors.phone}
                {...register('phone')}
              />
              {errors.phone ? (
                <p className="text-xs text-destructive">{t('auth.phoneInvalid')}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">{t('auth.password')}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pe-10"
                  invalid={!!errors.password}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-xs text-destructive">{t('auth.passwordTooShort')}</p>
              ) : null}
            </div>

            <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
              {isSubmitting ? t('common.submitting') : t('auth.registerAction')}
            </Button>
          </form>
        </CardContent>
        <div className="border-t border-border/60 p-5 sm:p-6">
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
              {t('auth.loginInstead')}
            </Link>
          </p>
        </div>
      </Card>
    </AuthLayout>
  );
}
