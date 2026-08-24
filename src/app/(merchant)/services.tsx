import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  Screen,
  Subtle,
  formatMoney,
} from '@/components/ui-kit';
import { getServices, upsertService } from '@/lib/api';
import type { PricingUnit } from '@/lib/domain/pricing';
import { useActiveShop } from '@/lib/use-active-shop';

const UNIT_OPTIONS: { value: PricingUnit; label: string }[] = [
  { value: 'per_kg', label: 'Per kg' },
  { value: 'per_item', label: 'Per item' },
  { value: 'flat', label: 'Flat' },
];

export default function MerchantServices() {
  const queryClient = useQueryClient();
  const { shop, isLoading: isShopLoading } = useActiveShop();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<PricingUnit>('per_kg');
  const [error, setError] = useState('');

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', shop?.id],
    queryFn: () => getServices(shop!.id),
    enabled: Boolean(shop),
  });

  const mutation = useMutation({
    mutationFn: () =>
      upsertService({
        shop_id: shop!.id,
        name: name.trim(),
        unit,
        price: Number(price),
      }),
    onSuccess: () => {
      setName('');
      setPrice('');
      setError('');
      queryClient.invalidateQueries({ queryKey: ['services', shop?.id] });
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleAdd = () => {
    const parsedPrice = Number(price);
    if (!name.trim()) {
      setError('Enter a service name.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Enter a valid price.');
      return;
    }
    mutation.mutate();
  };

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) return <EmptyState message="No shop assigned to your account yet." />;

  return (
    <Screen>
      {services?.map((service) => (
        <Card key={service.id}>
          <Text style={{ fontWeight: '600' }}>{service.name}</Text>
          <Subtle>
            {formatMoney(service.price)}{' '}
            {service.unit === 'per_kg' ? '/kg' : service.unit === 'per_item' ? '/item' : 'flat'}
          </Subtle>
        </Card>
      ))}
      <Card>
        <Text style={{ fontWeight: '600', fontSize: 16 }}>Add service</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Wash & Fold" />
        <Field
          label="Price"
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder="35.00"
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {UNIT_OPTIONS.map((option) => (
            <View key={option.value} style={{ flex: 1 }}>
              <Button
                title={option.label}
                variant={unit === option.value ? 'primary' : 'outline'}
                onPress={() => setUnit(option.value)}
              />
            </View>
          ))}
        </View>
        <ErrorText>{error}</ErrorText>
        <Button
          title={mutation.isPending ? 'Saving…' : 'Add service'}
          onPress={handleAdd}
          disabled={mutation.isPending}
        />
      </Card>
    </Screen>
  );
}
