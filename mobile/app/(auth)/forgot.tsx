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
import { Card } from '@/ui/Card';
import { Auth } from '@/api/endpoints';
import { t } from '@/i18n';
import { showErrorAlert } from '@/lib/errors';
import { isValidLocalEgyptPhone, normalizeDigits, toE164 } from '@/lib/phone';

const Schema = z.object({
  phone: z
    .string()
    .min(1, 'required')
    .refine((v) => isValidLocalEgyptPhone(normalizeDigits(v).replace(/[\s-]/g, '')), { message: 'invalid' }),
});
type Form = z.infer<typeof Schema>;

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { phone: '' },
  });

  const onSubmit = async (data: Form) => {
    const phoneE164 = toE164(data.phone);
    if (!phoneE164) {
      showErrorAlert({ response: { data: { error: { code: 'VALIDATION_ERROR' } } } });
      return;
    }
    setSubmitting(true);
    try {
      const result = await Auth.forgotPassword(phoneE164);
      // Always navigate to reset screen — even if the phone doesn't exist (we don't leak).
      router.push({
        pathname: '/(auth)/reset',
        params: {
          phone: phoneE164,
          devCode: result.devCode ?? '',
        },
      } as any);
    } catch (err) {
      showErrorAlert(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Header title={t('auth.forgotTitle')} back subtitle={t('auth.forgotSubtitle')} />
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
              onChangeText={(v) => onChange(normalizeDigits(v).replace(/[^\d]/g, ''))}
              onBlur={onBlur}
              error={errors.phone ? t('auth.phoneInvalid') : undefined}
              hint={!errors.phone ? t('auth.phoneHint') : undefined}
            />
          )}
        />
        <Button label={t('auth.sendCode')} loading={submitting} onPress={handleSubmit(onSubmit)} />
        <View className="items-center mt-2">
          <Text className="text-accent text-sm" onPress={() => router.back()}>
            {t('auth.backToLogin')}
          </Text>
        </View>
      </View>
    </Screen>
  );
}
