import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { AlertCircle, Mail } from 'lucide-react';
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
});
type FormValues = z.infer<typeof schema>;

type Step = 'phone' | 'confirm';

export function ForgotPasswordPage() {
  const t = useT();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('phone');
  const [emailMasked, setEmailMasked] = useState<string | null>(null);
  const [confirmedPhone, setConfirmedPhone] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '' },
    mode: 'onBlur',
  });

  const showServerError = (err: unknown) => {
    const e = readApiError(err);
    const key = `errors.${e.code}`;
    const msg = t(key);
    setServerError(msg === key ? t('errors.UNKNOWN') : msg);
  };

  // Step 1: phone → lookup email
  const onLookup = form.handleSubmit(async (values) => {
    setServerError(null);
    setInfo(null);
    try {
      const phone = toE164Egypt(values.phone);
      const res = await AuthApi.lookupResetEmail({ phone });
      setEmailMasked(res.emailMasked);
      setConfirmedPhone(phone);
      setStep('confirm');
    } catch (err) {
      showServerError(err);
    }
  });

  // Step 2: confirm → send OTP to the email already on file
  const onSendCode = async () => {
    if (!confirmedPhone) return;
    setServerError(null);
    setSending(true);
    try {
      const res = await AuthApi.forgotPassword({ phone: confirmedPhone });
      if (res.devCode) {
        // eslint-disable-next-line no-console
        console.info(`[dev] reset code: ${res.devCode}`);
      }
      setInfo(t('auth.forgot.sent'));
      const params = new URLSearchParams({ phone: confirmedPhone });
      setTimeout(() => navigate(`/reset-password?${params.toString()}`, { replace: false }), 600);
    } catch (err) {
      showServerError(err);
    } finally {
      setSending(false);
    }
  };

  const reenterPhone = () => {
    setStep('phone');
    setEmailMasked(null);
    setConfirmedPhone(null);
    setInfo(null);
    setServerError(null);
  };

  return (
    <AuthLayout>
      <Card className="shadow-elevated">
        <CardHeader>
          <CardTitle className="text-2xl">{t('auth.forgot.title')}</CardTitle>
          <CardDescription>
            {step === 'phone' ? t('auth.forgot.subtitlePhoneOnly') : t('auth.forgot.subtitleConfirm')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {serverError ? (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            </motion.div>
          ) : null}

          {info ? (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}>
              <Alert>
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            </motion.div>
          ) : null}

          {step === 'phone' ? (
            <form onSubmit={onLookup} className="space-y-4" noValidate>
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

              <Button type="submit" fullWidth size="lg" loading={form.formState.isSubmitting}>
                {t('auth.forgot.continue')}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone-readonly">{t('auth.phone')}</Label>
                <Input id="phone-readonly" value={confirmedPhone ?? ''} readOnly dir="ltr" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email-readonly">{t('auth.forgot.emailOnFile')}</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email-readonly"
                    type="email"
                    value={emailMasked ?? ''}
                    readOnly
                    dir="ltr"
                    className="ps-9 font-mono tracking-wide"
                    aria-describedby="email-readonly-help"
                  />
                </div>
                <p id="email-readonly-help" className="text-xs text-muted-foreground">
                  {t('auth.forgot.emailReadonlyHint')}
                </p>
              </div>

              <Button type="button" fullWidth size="lg" loading={sending} onClick={onSendCode}>
                {t('auth.forgot.sendToThisEmail')}
              </Button>

              <button
                type="button"
                onClick={reenterPhone}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                {t('auth.forgot.usePhoneInstead')}
              </button>
            </div>
          )}

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
