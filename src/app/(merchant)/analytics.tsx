import { useQuery } from '@tanstack/react-query';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';

import {
  Card,
  EmptyState,
  ErrorText,
  Loading,
  STATUS_LABELS,
  Screen,
  Subtle,
  colors,
  formatMoney,
} from '@/components/ui-kit';
import { getShopAnalytics, getShopOrders } from '@/lib/api';
import { computeDailyMoney } from '@/lib/domain/daily-analytics';
import { ORDER_STATUSES } from '@/lib/domain/order-status';
import { useActiveShop } from '@/lib/use-active-shop';

function MoneyCard({ label, amount, hint }: { label: string; amount: number; hint: string }) {
  return (
    <Card>
      <Subtle>{label}</Subtle>
      <Text style={{ fontWeight: '700', fontSize: 24, color: colors.text }}>
        {formatMoney(amount)}
      </Text>
      <Subtle>{hint}</Subtle>
    </Card>
  );
}

export default function MerchantAnalytics() {
  const { shop, isLoading: isShopLoading } = useActiveShop();

  const { data, isLoading, error } = useQuery({
    queryKey: ['shop-analytics', shop?.id],
    queryFn: () => getShopAnalytics(shop!.id),
    enabled: Boolean(shop),
  });

  const { data: orders } = useQuery({
    queryKey: ['shop-orders', shop?.id],
    queryFn: () => getShopOrders(shop!.id),
    enabled: Boolean(shop),
    refetchInterval: 15_000,
  });

  const daily = useMemo(
    () => computeDailyMoney(orders ?? [], new Date()),
    [orders]
  );

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) return <EmptyState message="No shop assigned to your account yet." />;

  return (
    <Screen>
      {error ? <ErrorText>{error.message}</ErrorText> : null}

      <Text style={{ fontWeight: '700', fontSize: 18 }}>Today</Text>
      <MoneyCard
        label="Collected today"
        amount={daily.collectedToday}
        hint="Payments received today"
      />
      <MoneyCard
        label="Projected today"
        amount={daily.projectedToday}
        hint="Collected + today's orders still to be paid"
      />
      <MoneyCard
        label="To collect from customers"
        amount={daily.receivables}
        hint="All unpaid orders, any date"
      />
      <Card>
        <Subtle>Orders today</Subtle>
        <Text style={{ fontSize: 16 }}>{daily.ordersToday}</Text>
      </Card>

      {data && (
        <>
          <Text style={{ fontWeight: '700', fontSize: 18 }}>All time</Text>
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
              <View
                key={status}
                style={{ flexDirection: 'row', justifyContent: 'space-between' }}
              >
                <Text>{STATUS_LABELS[status]}</Text>
                <Text>{data.orders_by_status[status]}</Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
