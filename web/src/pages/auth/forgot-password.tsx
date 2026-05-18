import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { AuthLayout } from '@/components/layout/auth-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useT } from '@/i18n';
import { AuthApi } from '@/lib/api/endpoints';
import { readApiError } from '@/lib/api/client';
import { EGY_PHONE_REGEX, normalizeEgyPhone, toE164Egypt } from '@/lib/phone';

const schema = z.object({
  phone: z.string().regex(EGY_PHONE_REGEX),
  email: z.string().trim().email(),
});
type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '', email: '' },
    mode: 'onBlur',
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    setInfo(null);
    try {
      const phone = toE164Egypt(values.phone);
      const email = values.email.trim().toLowerCase();
      const res = await AuthApi.forgotPassword({ phone, email });
      if (res.devCode) {
        // Dev convenience: surface the code so the flow is usable without real SMTP.
        // eslint-disable-next-line no-console
        console.info(`[dev] reset code: ${res.devCode}`);
      }
      setInfo(t('auth.forgot.sent'));
      const params = new URLSearchParams({ phone, email });
      // Give the user a beat to read the confirmation before navigating.
      setTimeout(() => navigate(`/reset-password?${params.toString()}`, { replace: false }), 600);
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
          <CardTitle className="text-2xl">{t('auth.forgot.title')}</CardTitle>
          <CardDescription>{t('auth.forgot.subtitlePhoneEmail')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {info ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Alert>
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            </motion.div>
          ) : null}

          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t('auth.phone')}</Label>
              {(() => {
                const phoneField = form.register('phone');
                return (
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={11}
                    placeholder={t('auth.phonePlaceholder')}
                    dir="ltr"
                    invalid={!!form.formState.errors.phone}
                    {...phoneField}
                    onChange={(e) => {
                      e.target.value = normalizeEgyPhone(e.target.value);
                      void phoneField.onChange(e);
                    }}
                  />
                );
              })()}
              {form.formState.errors.phone ? (
                <p className="text-xs text-destructive">{t('auth.phoneInvalid')}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">{t('auth.forgot.phoneHint')}</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">{t('auth.email')}</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t('auth.emailPlaceholder')}
                dir="ltr"
                invalid={!!form.formState.errors.email}
                {...form.register('email')}
              />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">{t('auth.emailInvalid')}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">{t('auth.forgot.emailHint')}</p>
            </div>

            <Button type="submit" fullWidth size="lg" loading={form.formState.isSubmitting}>
              {t('auth.forgot.send')}
            </Button>
          </form>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Link to="/reset-password" className="hover:text-foreground">
              {t('auth.forgot.haveCode')}
            </Link>
            <Link to="/login" className="hover:text-foreground">
              {t('auth.forgot.backToLogin')}
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
