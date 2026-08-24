import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';

import { ServiceOrderForm } from '@/components/service-order-form';
import { EmptyState, Screen, Title } from '@/components/ui-kit';

export default function NewOrder() {
  const { shopId } = useLocalSearchParams<{ shopId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  if (!shopId) {
    return (
      <Screen>
        <EmptyState message="Pick a shop first from the Shops tab." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>New order</Title>
      <ServiceOrderForm
        shopId={shopId}
        submitLabel="Place order"
        onSuccess={async (order) => {
          await queryClient.invalidateQueries({ queryKey: ['my-orders'] });
          router.replace(`/(customer)/order/${order.id}`);
        }}
      />
    </Screen>
  );
}
