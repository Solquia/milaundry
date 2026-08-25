import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Text } from 'react-native';

import { ServiceOrderForm } from '@/components/service-order-form';
import {
  Button,
  Card,
  EmptyState,
  Loading,
  Screen,
  Subtle,
  Title,
  formatMoney,
} from '@/components/ui-kit';
import { orderTags } from '@/lib/domain/order-tags';
import type { OrderRow } from '@/lib/types';
import { useActiveShop } from '@/lib/use-active-shop';

export default function Pos() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { shop, isLoading } = useActiveShop();
  const [lastOrder, setLastOrder] = useState<OrderRow | null>(null);
  // Bumping the key remounts the form, clearing it for the next customer.
  const [formKey, setFormKey] = useState(0);

  if (isLoading) return <Loading />;
  if (!shop) return <EmptyState message="No shop assigned to your account yet." />;

  const handleSuccess = async (order: OrderRow) => {
    await queryClient.invalidateQueries({ queryKey: ['shop-orders', shop.id] });
    setLastOrder(order);
  };

  const startNext = () => {
    setLastOrder(null);
    setFormKey((key) => key + 1);
  };

  if (lastOrder) {
    return (
      <Screen>
        <Title>Order saved ✓</Title>
        <Card>
          <Text style={{ fontWeight: '600', fontSize: 16 }}>
            {lastOrder.customer_name || 'Walk-in customer'}
          </Text>
          <Subtle>{orderTags(lastOrder).join(' · ')}</Subtle>
          <Text style={{ fontWeight: '700', fontSize: 18 }}>
            {formatMoney(lastOrder.final_total ?? lastOrder.estimated_total)}
          </Text>
        </Card>
        <Button title="Add another walk-in" onPress={startNext} />
        <Button
          title="View order"
          variant="outline"
          onPress={() => {
            const orderId = lastOrder.id;
            startNext();
            router.push(`/(merchant)/order/${orderId}`);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>New walk-in order</Title>
      <Subtle>
        Jot down the customer, pick their services, and the order lands in the Orders tab tagged
        as a walk-in.
      </Subtle>
      <ServiceOrderForm
        key={formKey}
        shopId={shop.id}
        mode="walk_in"
        submitLabel="Save walk-in order"
        onSuccess={handleSuccess}
      />
    </Screen>
  );
}
