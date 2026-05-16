import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { v4 as uuidv4 } from 'uuid';
import { Screen } from '@/ui/Screen';
import { Header } from '@/ui/Header';
import { Input } from '@/ui/Input';
import { Button } from '@/ui/Button';
import { Expenses } from '@/api/endpoints';
import { t } from '@/i18n';
import { enqueue } from '@/offline/queue';
import { useNetwork } from '@/stores/network.store';
import { showErrorAlert, toUserError } from '@/lib/errors';

const CATEGORIES = ['RENT', 'INSURANCE', 'FINE', 'TOLL', 'FOOD', 'PHONE', 'WASH', 'PARKING', 'OTHER'] as const;

const Schema = z.object({
  category: z.enum(CATEGORIES),
  amountEgp: z.coerce.number().positive(),
  isRecurring: z.boolean().default(false),
});
type Form = z.infer<typeof Schema>;

export default function NewExpenseScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const online = useNetwork((s) => s.online);

  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(Schema),
    defaultValues: { category: 'OTHER', amountEgp: 0, isRecurring: false },
  });

  const mutation = useMutation({ mutationFn: (b: any) => Expenses.create(b) });

  const onSubmit = async (data: Form) => {
    const body = {
      category: data.category,
      amountPiastres: Math.round(data.amountEgp * 100),
      dateTime: new Date().toISOString(),
      isRecurring: data.isRecurring,
      clientMutationId: uuidv4(),
    };
    try {
      if (online) await mutation.mutateAsync(body);
      else await enqueue({ endpoint: '/expenses', method: 'POST', body });
      qc.invalidateQueries({ queryKey: ['analytics'] });
      router.back();
    } catch (err) {
      const ue = toUserError(err);
      if (ue.isNetwork) {
        await enqueue({ endpoint: '/expenses', method: 'POST', body });
        router.back();
      } else {
        showErrorAlert(err);
      }
    }
  };

  return (
    <Screen>
      <Header title={t('expense.new')} back />
      <View className="gap-4 mt-2">
        <Controller
          control={control}
          name="category"
          render={({ field: { value, onChange } }) => (
            <View>
              <Text className="text-text mb-2 text-sm">{t('expense.category')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CATEGORIES.map((c) => {
                  const active = c === value;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => onChange(c)}
                      className={`px-4 h-10 rounded-full items-center justify-center ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
                    >
                      <Text className={`text-sm font-medium ${active ? 'text-bg' : 'text-text'}`}>
                        {t(`expense.categories.${c}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        />
        <Controller
          control={control}
          name="amountEgp"
          render={({ field: { value, onChange } }) => (
            <Input
              label={t('expense.amount')}
              keyboardType="numeric"
              value={String(value || '')}
              onChangeText={(v) => onChange(v.replace(/[^\d.]/g, ''))}
              error={errors.amountEgp?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="isRecurring"
          render={({ field: { value, onChange } }) => (
            <Pressable
              onPress={() => onChange(!value)}
              className="bg-surface rounded-xl p-4 border border-border flex-row items-center justify-between"
            >
              <Text className="text-text">{t('expense.recurring')}</Text>
              <View className={`w-12 h-7 rounded-full ${value ? 'bg-accent' : 'bg-surface2'} items-${value ? 'end' : 'start'} justify-center px-1`}>
                <View className="w-5 h-5 rounded-full bg-bg" />
              </View>
            </Pressable>
          )}
        />
        <Button label={t('common.save')} loading={mutation.isPending} onPress={handleSubmit(onSubmit)} />
      </View>
    </Screen>
  );
}
