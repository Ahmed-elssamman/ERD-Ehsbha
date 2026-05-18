import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { AlertCircle, Eye, EyeOff } from 'lucide-react';
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
  email: z.string().trim().email().optional().or(z.literal('')),
  code: z.string().regex(/^\d{6}$/),
  newPassword: z.string().min(8).max(128),
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Accept both new (?phone=&email=) and legacy (?contact=&channel=) query strings
  // so a bookmarked link doesn't break the form.
  const initialPhoneRaw = params.get('phone') ?? '';
  const initialEmail = params.get('email') ?? '';
  const legacyContact = params.get('contact') ?? '';
  const legacyChannel = params.get('channel');
  const initialPhone =
    initialPhoneRaw || (legacyChannel === 'phone' ? legacyContact : '');
  const initialEmailFallback =
    initialEmail || (legacyChannel === 'email' ? legacyContact : '');

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: initialPhone,
      email: initialEmailFallback,
      code: '',
      newPassword: '',
    },
    mode: 'onBlur',
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);
    try {
      await AuthApi.resetPassword({
        phone: toE164Egypt(values.phone),
        code: values.code,
        newPassword: values.newPassword,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (err) {
      const e = readApiError(err);
      const key = `errors.${e.code}`;
      const msg = t(key);
      setServerError(msg === key ? t('errors.UNKNOWN') : msg);
    }
  });

  const handleResend = async () => {
    const phone = form.getValues('phone');
    const email = form.getValues('email');
    if (!phone || !email) return;
    setResending(true);
    setResent(false);
    try {
      await AuthApi.forgotPassword({
        phone: toE164Egypt(phone),
        email: email.trim().toLowerCase(),
      });
      setResent(true);
      setTimeout(() => setResent(false), 2500);
    } catch {
      // Ignore — the user can try again or correct the fields.
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-2xl">{t('auth.reset.title')}</CardTitle>
          <CardDescription>{t('auth.reset.subtitle')}</CardDescription>
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

            {success ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <Alert>
                  <AlertDescription>{t('auth.reset.success')}</AlertDescription>
                </Alert>
              </motion.div>
            ) : null}

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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">
                {t('auth.email')}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                  ({t('common.optional')})
                </span>
              </Label>
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
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="code">{t('auth.reset.code')}</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder={t('auth.reset.codePlaceholder')}
                dir="ltr"
                invalid={!!form.formState.errors.code}
                className="font-mono text-lg tracking-[0.4em]"
                {...form.register('code')}
              />
              {form.formState.errors.code ? (
                <p className="text-xs text-destructive">{t('auth.reset.codeInvalid')}</p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="newPassword">{t('auth.reset.newPassword')}</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPwd ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="pe-10"
                  invalid={!!form.formState.errors.newPassword}
                  {...form.register('newPassword')}
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
              {form.formState.errors.newPassword ? (
                <p className="text-xs text-destructive">{t('auth.passwordTooShort')}</p>
              ) : null}
            </div>

            <Button type="submit" fullWidth size="lg" loading={form.formState.isSubmitting}>
              {t('auth.reset.submit')}
            </Button>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="hover:text-foreground disabled:opacity-50"
              >
                {resent ? t('auth.reset.resent') : t('auth.reset.resend')}
              </button>
              <Link to="/login" className="hover:text-foreground">
                {t('auth.forgot.backToLogin')}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
