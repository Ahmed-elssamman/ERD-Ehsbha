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
import { isValidLocalEgyptPhone, toE164 } from '@/lib/phone';

const Schema = z.object({
  phone: z
    .string()
    .min(1, 'required')
    .refine((v) => isValidLocalEgyptPhone(v.replace(/[\s-]/g, '')), {
      message: 'invalid',
    }),
  password: z.string().min(8).max(128),
});
type Form = z.infer<typeof Schema>;

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [submitting, setSubmitting] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { phone: '', password: '' },
  });

  const onSubmit = async (data: Form) => {
    const phoneE164 = toE164(data.phone);
    if (!phoneE164) {
      showErrorAlert({ response: { data: { error: { code: 'VALIDATION_ERROR' } } } });
      return;
    }
    setSubmitting(true);
    try {
      const result = await Auth.login({ phone: phoneE164, password: data.password });
      await setSession(result);
      router.replace('/(tabs)/home');
    } catch (err) {
      showErrorAlert(err);
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
              onChangeText={(v) => onChange(v.replace(/[^\d]/g, ''))}
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

        <Button label={t('auth.login')} loading={submitting} onPress={handleSubmit(onSubmit)} />

        <View className="items-center mt-1">
          <Text className="text-accent text-sm" onPress={() => router.push('/(auth)/forgot' as any)}>
            {t('auth.forgotPassword')}
          </Text>
        </View>

        <View className="items-center mt-2">
          <Text className="text-textMuted text-sm">
            {t('auth.noAccount')}{' '}
            <Text className="text-accent" onPress={() => router.replace('/(auth)/register')}>
              {t('auth.createAccount')}
            </Text>
          </Text>
        </View>
      </View>
    </Screen>
  );
}
