import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Screen,
  StatusBadge,
  Subtle,
  Tag,
  colors,
  formatMoney,
} from '@/components/ui-kit';
import { getShopOrders, type OrderWithDetails } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatOrderTime, shortOrderId } from '@/lib/domain/order-card';
import { TERMINAL_STATUSES } from '@/lib/domain/order-status';
import { orderTags } from '@/lib/domain/order-tags';
import { useActiveShop } from '@/lib/use-active-shop';

const FILTERS = ['Active', 'Walk-in', 'Online', 'Unpaid', 'All'] as const;
type Filter = (typeof FILTERS)[number];

function applyFilter(orders: OrderWithDetails[], filter: Filter): OrderWithDetails[] {
  switch (filter) {
    case 'Active':
      return orders.filter((order) => !TERMINAL_STATUSES.includes(order.status));
    case 'Walk-in':
      return orders.filter((order) => order.order_type === 'walk_in');
    case 'Online':
      return orders.filter((order) => order.order_type === 'online');
    case 'Unpaid':
      return orders.filter(
        (order) => order.payment_status === 'unpaid' && order.status !== 'cancelled'
      );
    case 'All':
      return orders;
  }
}

export default function MerchantOrders() {
  const { signOut } = useAuth();
  const router = useRouter();
  const { shop, isLoading: isShopLoading } = useActiveShop();
  const [filter, setFilter] = useState<Filter>('Active');
  // Captured once per render so every card dates itself against the same clock.
  const now = new Date();

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['shop-orders', shop?.id],
    queryFn: () => getShopOrders(shop!.id),
    enabled: Boolean(shop),
    refetchInterval: 15_000,
  });

  const visibleOrders = useMemo(
    () => applyFilter(orders ?? [], filter),
    [orders, filter]
  );

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) return <EmptyState message="No shop assigned to your account yet. Ask the administrator." />;

  return (
    <Screen>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === option }}
            onPress={() => setFilter(option)}
            style={{
              borderRadius: 999,
              paddingHorizontal: 14,
              paddingVertical: 6,
              backgroundColor: filter === option ? colors.primary : colors.card,
              borderWidth: 1,
              borderColor: filter === option ? colors.primary : colors.border,
            }}
          >
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: filter === option ? '#FFFFFF' : colors.subtle,
              }}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <ErrorText>{error.message}</ErrorText> : null}
      {visibleOrders.length === 0 && (
        <EmptyState
          message={
            filter === 'Active'
              ? 'No active orders. Create one from the POS tab.'
              : `No ${filter.toLowerCase()} orders.`
          }
        />
      )}
      {visibleOrders.map((order) => {
        const total = order.final_total ?? order.estimated_total;
        return (
          <Pressable
            key={order.id}
            accessibilityRole="button"
            accessibilityLabel={`Open order for ${order.customer_name || 'walk-in customer'}, ${formatMoney(total)}`}
            onPress={() => router.push(`/(merchant)/order/${order.id}`)}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Card compact>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text style={{ fontWeight: '600', fontSize: 15, flexShrink: 1 }} numberOfLines={1}>
                  {order.customer_name || 'Walk-in customer'}
                </Text>
                <Text style={{ fontWeight: '700', fontSize: 15 }}>{formatMoney(total)}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                <StatusBadge status={order.status} />
                {orderTags(order).map((tag) => (
                  <Tag key={tag} label={tag} />
                ))}
              </View>
              <Text style={{ fontSize: 12, color: colors.subtle }} numberOfLines={1}>
                {shortOrderId(order.id)} · {formatOrderTime(order.created_at, now)}
                {order.customer_phone ? ` · ${order.customer_phone}` : ''}
              </Text>
            </Card>
          </Pressable>
        );
      })}
      <Subtle onPress={() => signOut()}>Sign out</Subtle>
    </Screen>
  );
}
