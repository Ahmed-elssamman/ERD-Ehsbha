import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Auth } from '@/api/endpoints';
import { t } from '@/i18n';
import { showErrorAlert } from '@/lib/errors';
import { fromE164 } from '@/lib/phone';
import { normalizeIntInput } from '@/lib/numbers';
import { go, ROUTES } from '@/constants/routes';

const Schema = z
  .object({
    code: z.string().regex(/^\d{6}$/, 'invalid'),
    newPassword: z.string().min(8).max(128),
    confirmPassword: z.string().min(8).max(128),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'mismatch',
    path: ['confirmPassword'],
  });
type Form = z.infer<typeof Schema>;

export default function ResetPasswordScreen(): React.ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; devCode?: string }>();
  const phone = params.phone ?? '';
  const devCode = params.devCode ?? '';
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { code: devCode || '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: Form) => {
    setSubmitting(true);
    try {
      await Auth.resetPassword(phone, data.code, data.newPassword);
      Alert.alert(t('auth.resetSuccess'), t('auth.resetSuccessBody'), [
        { text: t('common.ok'), onPress: () => router.replace(go(ROUTES.LOGIN)) },
      ]);
    } catch (err) {
      showErrorAlert(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header title={t('auth.resetTitle')} back subtitle={t('auth.resetSubtitle')} />

      <Card className="mb-4">
        <Text className="text-textMuted text-xs mb-1">{t('auth.phone')}</Text>
        <Text className="text-text font-bold text-base">{fromE164(phone)}</Text>
      </Card>

      {devCode ? (
        <Card className="mb-4 border-warn/60 bg-warn/15">
          <Text className="text-warn text-xs font-bold mb-2">⚠ {t('auth.devCodeNote')}</Text>
          <Text className="text-text text-4xl font-bold tracking-widest text-center my-1">{devCode}</Text>
          <Text className="text-textMuted text-xs mt-2 text-center">{t('auth.smsComingSoon')}</Text>
        </Card>
      ) : null}

      <View className="gap-4">
        <Controller
          control={control}
          name="code"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label={t('auth.code')}
              keyboardType="number-pad"
              autoCapitalize="none"
              maxLength={6}
              placeholder="000000"
              value={value}
              onChangeText={(v) => onChange(normalizeIntInput(v))}
              onBlur={onBlur}
              error={errors.code ? t('auth.phoneInvalid') : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="newPassword"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label={t('auth.newPassword')}
              secureTextEntry
              autoCapitalize="none"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.newPassword ? t('auth.passwordTooShort') : undefined}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { value, onChange, onBlur } }) => (
            <Input
              label={t('auth.confirmPassword')}
              secureTextEntry
              autoCapitalize="none"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.confirmPassword ? t('auth.passwordsDontMatch') : undefined}
            />
          )}
        />
        <Button label={t('auth.resetSubmit')} loading={submitting} onPress={handleSubmit(onSubmit)} />
        <View className="items-center mt-2">
          <Text className="text-accent text-sm" onPress={() => router.replace(go(ROUTES.LOGIN))}>
            {t('auth.backToLogin')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}
