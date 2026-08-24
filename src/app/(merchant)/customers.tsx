import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Text } from 'react-native';

import {
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Screen,
  Subtle,
  formatDate,
  formatMoney,
} from '@/components/ui-kit';
import { getShopCustomers } from '@/lib/api';
import { useActiveShop } from '@/lib/use-active-shop';

export default function MerchantCustomers() {
  const { shop, isLoading: isShopLoading } = useActiveShop();

  const { data: customers, isLoading, error } = useQuery({
    queryKey: ['shop-customers', shop?.id],
    queryFn: () => getShopCustomers(shop!.id),
    enabled: Boolean(shop),
  });

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) return <EmptyState message="No shop assigned to your account yet." />;

  return (
    <Screen>
      {error ? <ErrorText>{error.message}</ErrorText> : null}
      {customers?.length === 0 && (
        <EmptyState message="No registered customers yet. Share your shop QR or order QRs to register them." />
      )}
      {customers?.map((customer) => (
        <Card key={customer.customer_id}>
          <Text style={{ fontWeight: '600', fontSize: 16 }}>
            {customer.full_name || 'Unnamed customer'}
          </Text>
          <Subtle>{customer.phone}</Subtle>
          <Subtle>
            {customer.order_count} orders · {formatMoney(Number(customer.total_spend))} spent
          </Subtle>
          <Subtle>
            {customer.last_order_at
              ? `Last order ${formatDate(customer.last_order_at)}`
              : 'No orders yet'}
          </Subtle>
        </Card>
      ))}
    </Screen>
  );
}
