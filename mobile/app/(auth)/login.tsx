import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller, type FieldErrors } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Auth } from '@/api/endpoints';
import { useAuth } from '@/stores/auth.store';
import { t } from '@/i18n';
import { showErrorAlert } from '@/lib/errors';
import { isValidLocalEgyptPhone, normalizeDigits, toE164 } from '@/lib/phone';
import { go, ROUTES } from '@/constants/routes';

const Schema = z.object({
  phone: z
    .string()
    .min(1, 'required')
    .refine((v) => isValidLocalEgyptPhone(normalizeDigits(v).replace(/[\s-]/g, '')), {
      message: 'invalid',
    }),
  password: z.string().min(8).max(128),
});
type Form = z.infer<typeof Schema>;

export default function LoginScreen(): React.ReactElement {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { phone: '', password: '' },
    mode: 'onSubmit',
  });

  const onInvalid = (errs: FieldErrors<Form>): void => {
    const first = Object.keys(errs)[0];
    if (first === 'phone') setApiError(t('auth.phoneInvalid'));
    else if (first === 'password') setApiError(t('auth.passwordTooShort'));
    else setApiError(t('errors.VALIDATION_ERROR'));
  };

  const onSubmit = async (data: Form): Promise<void> => {
    setApiError(null);
    const phoneE164 = toE164(data.phone);
    if (!phoneE164) {
      setApiError(t('auth.phoneInvalid'));
      return;
    }
    const password = data.password.trim();
    if (password.length < 8) {
      setApiError(t('auth.passwordTooShort'));
      return;
    }
    setSubmitting(true);
    try {
      const result = await Auth.login({ phone: phoneE164, password });
      setApiError(null);
      await setSession(result);
      router.replace(go(ROUTES.HOME));
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: { code?: string } } } } | undefined;
      const code = e?.response?.data?.error?.code;
      if (code === 'INVALID_CREDENTIALS' || e?.response?.status === 401) {
        setApiError(t('auth.invalidCredentials'));
      } else if (!e?.response) {
        setApiError(t('errors.NETWORK_OFFLINE'));
        showErrorAlert(err);
      } else {
        showErrorAlert(err);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header title={t('auth.login')} back />
      <View className="gap-4 mt-4">
        <Controller
          control={control}
          name="phone"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label={t('auth.phone')}
              keyboardType="phone-pad"
              autoCapitalize="none"
              maxLength={11}
              placeholder="01019579006"
              value={value}
              // Normalize Arabic/Persian digits to Latin AND strip non-digits.
              onChangeText={(v) => onChange(normalizeDigits(v).replace(/[^\d]/g, ''))}
              onBlur={onBlur}
              error={errors.phone ? t('auth.phoneInvalid') : undefined}
              hint={!errors.phone ? t('auth.phoneHint') : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label={t('auth.password')}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.password ? t('auth.passwordTooShort') : undefined}
            />
          )}
        />

        {apiError ? (
          <View className="bg-danger/10 border border-danger/40 rounded-xl p-3">
            <Text className="text-danger text-sm text-center">{apiError}</Text>
          </View>
        ) : null}

        <Button label={t('auth.login')} loading={submitting} onPress={handleSubmit(onSubmit, onInvalid)} />

        <View className="items-center mt-1">
          <Text className="text-accent text-sm" onPress={() => router.push(go(ROUTES.FORGOT))}>
            {t('auth.forgotPassword')}
          </Text>
        </View>

        <View className="items-center mt-2">
          <Text className="text-textMuted text-sm">
            {t('auth.noAccount')}{' '}
            <Text className="text-accent" onPress={() => router.replace(go(ROUTES.REGISTER))}>
              {t('auth.createAccount')}
            </Text>
          </Text>
        </View>
      </View>
    </Screen>
  );
}
