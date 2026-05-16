import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
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

const Schema = z.object({
  displayName: z.string().min(2).max(80),
  phone: z
    .string()
    .min(1, 'required')
    .refine((v) => isValidLocalEgyptPhone(normalizeDigits(v).replace(/[\s-]/g, '')), { message: 'invalid' }),
  password: z.string().min(8).max(128),
});
type Form = z.infer<typeof Schema>;

export default function RegisterScreen() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { displayName: '', phone: '', password: '' },
  });

  const [apiError, setApiError] = React.useState<string | null>(null);

  const onSubmit = async (data: Form) => {
    setApiError(null);
    const phoneE164 = toE164(data.phone.trim());
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
      const result = await Auth.register({
        displayName: data.displayName.trim(),
        phone: phoneE164,
        password,
      });
      setApiError(null);
      await setSession(result);
      router.replace('/(tabs)/home');
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === 'PHONE_TAKEN') {
        setApiError(t('errors.PHONE_TAKEN'));
      } else if (!err?.response) {
        setApiError(t('errors.UNKNOWN'));
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
      <Header title={t('auth.createAccount')} back />
      <View className="gap-4 mt-4">
        <Controller
          control={control}
          name="displayName"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label={t('auth.displayName')}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.displayName?.message}
            />
          )}
        />
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

        <Button
          label={t('auth.register')}
          loading={submitting}
          onPress={handleSubmit(onSubmit, (errs: any) => {
            const first = Object.keys(errs)[0];
            if (first === 'phone') setApiError(t('auth.phoneInvalid'));
            else if (first === 'password') setApiError(t('auth.passwordTooShort'));
            else if (first === 'displayName') setApiError(t('errors.VALIDATION_ERROR'));
            else setApiError(t('errors.VALIDATION_ERROR'));
          })}
        />
        <View className="items-center mt-2">
          <Text className="text-textMuted text-sm">{t('auth.hasAccount')}{' '}
            <Text className="text-accent" onPress={() => router.replace('/(auth)/login')}>
              {t('auth.alreadyMember')}
            </Text>
          </Text>
        </View>
      </View>
    </Screen>
  );
}
