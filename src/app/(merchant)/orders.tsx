import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
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
  formatDate,
  formatMoney,
} from '@/components/ui-kit';
import { getShopOrders, type OrderWithDetails } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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
  const { shop, isLoading: isShopLoading } = useActiveShop();
  const [filter, setFilter] = useState<Filter>('Active');

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
      {visibleOrders.map((order) => (
        <Link key={order.id} href={`/(merchant)/order/${order.id}`} asChild>
          <View>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: '600', fontSize: 16 }}>
                  {order.customer_name || 'Walk-in customer'}
                </Text>
                <Text style={{ fontWeight: '700' }}>
                  {formatMoney(order.final_total ?? order.estimated_total)}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                <StatusBadge status={order.status} />
                {orderTags(order).map((tag) => (
                  <Tag key={tag} label={tag} />
                ))}
              </View>
              <Subtle>
                #{order.id.slice(0, 8)} · {formatDate(order.created_at)}
                {order.customer_phone ? ` · ${order.customer_phone}` : ''}
              </Subtle>
            </Card>
          </View>
        </Link>
      ))}
      <Subtle onPress={() => signOut()}>Sign out</Subtle>
    </Screen>
  );
}
