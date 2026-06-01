import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
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
import { useT } from '@/i18n';
import { AuthApi } from '@/lib/api/endpoints';
import { readApiError } from '@/lib/api/client';
import { useAuth } from '@/stores/auth.store';
import { EGY_PHONE_REGEX, normalizeEgyPhone, toE164Egypt } from '@/lib/phone';

const DEMO = { phone: '01000000001', password: 'demo1234' };

const schema = z.object({
  phone: z.string().regex(EGY_PHONE_REGEX),
  password: z.string().min(1).max(128),
});
type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuth((s) => s.setSession);
  const [showPwd, setShowPwd] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onBlur',
    defaultValues: { phone: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const result = await AuthApi.login({ ...values, phone: toE164Egypt(values.phone) });
      setSession(result);
      const target = (location.state as { from?: string } | null)?.from ?? '/';
      navigate(target, { replace: true });
    } catch (err) {
      const e = readApiError(err);
      const key = `errors.${e.code}`;
      const msg = t(key);
      setServerError(msg === key ? t('errors.UNKNOWN') : msg);
    }
  });

  const fillDemo = () => {
    setValue('phone', DEMO.phone, { shouldValidate: true });
    setValue('password', DEMO.password, { shouldValidate: true });
  };

  return (
    <AuthLayout>
      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-2xl">{t('auth.welcomeBack')}</CardTitle>
          <CardDescription>{t('auth.welcomeBackSubtitle')}</CardDescription>
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
              <Label htmlFor="phone">{t('auth.phone')}</Label>
              {(() => {
                const phoneField = register('phone');
                return (
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={11}
                    placeholder={t('auth.phonePlaceholder')}
                    dir="ltr"
                    invalid={!!errors.phone}
                    {...phoneField}
                    onChange={(e) => {
                      e.target.value = normalizeEgyPhone(e.target.value);
                      void phoneField.onChange(e);
                    }}
                  />
                );
              })()}
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
                  autoComplete="current-password"
                  className="pe-10"
                  invalid={!!errors.password}
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? t('auth.hidePassword') : t('auth.showPassword')}
                  className="absolute end-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  tabIndex={0}
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
              {isSubmitting ? t('common.submitting') : t('auth.loginAction')}
            </Button>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                onClick={fillDemo}
                className="hover:text-foreground"
              >
                {t('auth.useDemo')}
              </button>
              <Link
                to="/forgot-password"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                {t('auth.forgotPassword')}
              </Link>
            </div>
          </form>
        </CardContent>
        <div className="border-t border-border/60 p-5 sm:p-6">
          <p className="text-center text-sm text-muted-foreground">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">
              {t('auth.createAccount')}
            </Link>
          </p>
        </div>
      </Card>
    </AuthLayout>
  );
}
