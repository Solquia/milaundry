import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { Text } from 'react-native';

import {
  Card,
  EmptyState,
  ErrorText,
  Loading,
  STATUS_LABELS,
  Screen,
  Subtle,
  formatMoney,
} from '@/components/ui-kit';
import { getShopAnalytics } from '@/lib/api';
import { ORDER_STATUSES } from '@/lib/domain/order-status';
import { useActiveShop } from '@/lib/use-active-shop';

export default function MerchantAnalytics() {
  const { shop, isLoading: isShopLoading } = useActiveShop();

  const { data, isLoading, error } = useQuery({
    queryKey: ['shop-analytics', shop?.id],
    queryFn: () => getShopAnalytics(shop!.id),
    enabled: Boolean(shop),
  });

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) return <EmptyState message="No shop assigned to your account yet." />;

  return (
    <Screen>
      {error ? <ErrorText>{error.message}</ErrorText> : null}
      {data && (
        <>
          <Card>
            <Subtle>Total revenue (completed orders)</Subtle>
            <Text style={{ fontWeight: '700', fontSize: 24 }}>
              {formatMoney(Number(data.total_revenue))}
            </Text>
          </Card>
          <Card>
            <Subtle>Orders</Subtle>
            <Text style={{ fontSize: 16 }}>
              {data.total_orders} total · {data.active_orders} active
            </Text>
          </Card>
          <Card>
            <Subtle>Customers</Subtle>
            <Text style={{ fontSize: 16 }}>
              {data.unique_customers} unique · {data.repeat_customers} repeat
            </Text>
          </Card>
          <Card>
            <Subtle>Orders by status</Subtle>
            {ORDER_STATUSES.filter((status) => data.orders_by_status[status]).map((status) => (
              <Text key={status}>
                {STATUS_LABELS[status]}: {data.orders_by_status[status]}
              </Text>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
