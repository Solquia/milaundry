import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Subtle,
  formatMoney,
} from '@/components/ui-kit';
import { getServices, placeOrder } from '@/lib/api';
import { estimateOrderTotal } from '@/lib/domain/pricing';
import type { OrderRow } from '@/lib/types';

type Props = {
  shopId: string;
  submitLabel: string;
  onSuccess: (order: OrderRow) => void;
};

export function ServiceOrderForm({ shopId, submitLabel, onSuccess }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', shopId],
    queryFn: () => getServices(shopId),
  });

  const selectedItems = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([serviceId, quantity]) => ({ serviceId, quantity })),
    [quantities]
  );

  const estimate = useMemo(() => {
    if (!services || selectedItems.length === 0) return null;
    try {
      return estimateOrderTotal(services, selectedItems);
    } catch {
      return null;
    }
  }, [services, selectedItems]);

  const mutation = useMutation({
    mutationFn: () =>
      placeOrder(
        shopId,
        selectedItems.map((item) => ({ service_id: item.serviceId, quantity: item.quantity }))
      ),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  const adjust = (serviceId: string, step: number) => {
    setQuantities((prev) => ({
      ...prev,
      [serviceId]: Math.max(0, Math.round(((prev[serviceId] ?? 0) + step) * 10) / 10),
    }));
  };

  if (isLoading) return <Loading />;

  return (
    <>
      {services?.length === 0 && (
        <EmptyState message="This shop has no services listed yet." />
      )}
      {services?.map((service) => {
        const qty = quantities[service.id] ?? 0;
        const step = service.unit === 'per_kg' ? 0.5 : 1;
        const unitLabel =
          service.unit === 'per_kg' ? '/kg' : service.unit === 'per_item' ? '/item' : ' flat';
        return (
          <Card key={service.id}>
            <Text style={{ fontWeight: '600', fontSize: 16 }}>{service.name}</Text>
            <Subtle>
              {formatMoney(service.price)}
              {unitLabel}
            </Subtle>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Button title="−" variant="outline" onPress={() => adjust(service.id, -step)} />
              </View>
              <Text style={{ fontSize: 16, minWidth: 56, textAlign: 'center' }}>
                {qty}
                {service.unit === 'per_kg' ? ' kg' : ''}
              </Text>
              <View style={{ flex: 1 }}>
                <Button title="+" variant="outline" onPress={() => adjust(service.id, step)} />
              </View>
            </View>
          </Card>
        );
      })}
      {estimate && (
        <Card>
          <Text style={{ fontWeight: '700', fontSize: 18 }}>
            Estimated total: {formatMoney(estimate.total)}
          </Text>
          <Subtle>Final price is confirmed by the shop after weighing.</Subtle>
        </Card>
      )}
      <ErrorText>{error}</ErrorText>
      <Button
        title={mutation.isPending ? 'Submitting…' : submitLabel}
        onPress={() => mutation.mutate()}
        disabled={selectedItems.length === 0 || mutation.isPending}
      />
    </>
  );
}
