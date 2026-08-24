import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';

import { ServiceOrderForm } from '@/components/service-order-form';
import { EmptyState, Loading, Screen, Subtle, Title } from '@/components/ui-kit';
import { useActiveShop } from '@/lib/use-active-shop';

export default function Pos() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { shop, isLoading } = useActiveShop();

  if (isLoading) return <Loading />;
  if (!shop) return <EmptyState message="No shop assigned to your account yet." />;

  return (
    <Screen>
      <Title>New walk-in order</Title>
      <Subtle>
        After creating the order, share its QR code so the customer can claim and track it.
      </Subtle>
      <ServiceOrderForm
        shopId={shop.id}
        submitLabel="Create order"
        onSuccess={async (order) => {
          await queryClient.invalidateQueries({ queryKey: ['shop-orders', shop.id] });
          router.push(`/(merchant)/order/${order.id}`);
        }}
      />
    </Screen>
  );
}
