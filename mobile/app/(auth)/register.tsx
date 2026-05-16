import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
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

const Schema = z.object({
  displayName: z.string().min(2).max(80),
  phone: z.string().regex(/^\+?\d{8,15}$/),
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

  const onSubmit = async (data: Form) => {
    setSubmitting(true);
    try {
      const result = await Auth.register(data);
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
              placeholder="+201000000001"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.phone?.message}
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
              error={errors.password?.message}
            />
          )}
        />
        <Button label={t('auth.register')} loading={submitting} onPress={handleSubmit(onSubmit)} />
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
