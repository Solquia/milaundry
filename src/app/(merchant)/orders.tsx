import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import {
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Screen,
  StatusBadge,
  Subtle,
  formatDate,
  formatMoney,
} from '@/components/ui-kit';
import { getShopOrders } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useActiveShop } from '@/lib/use-active-shop';

export default function MerchantOrders() {
  const { signOut } = useAuth();
  const { shop, isLoading: isShopLoading } = useActiveShop();

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['shop-orders', shop?.id],
    queryFn: () => getShopOrders(shop!.id),
    enabled: Boolean(shop),
    refetchInterval: 15_000,
  });

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) return <EmptyState message="No shop assigned to your account yet. Ask the administrator." />;

  return (
    <Screen>
      {error ? <ErrorText>{error.message}</ErrorText> : null}
      {orders?.length === 0 && <EmptyState message="No orders yet. Create one from the POS tab." />}
      {orders?.map((order) => (
        <Link key={order.id} href={`/(merchant)/order/${order.id}`} asChild>
          <View>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <StatusBadge status={order.status} />
                <Text style={{ fontWeight: '700' }}>
                  {formatMoney(order.final_total ?? order.estimated_total)}
                </Text>
              </View>
              <Subtle>
                #{order.id.slice(0, 8)} · {formatDate(order.created_at)}
                {order.customer_id === null ? ' · unclaimed' : ''}
              </Subtle>
            </Card>
          </View>
        </Link>
      ))}
      <Subtle onPress={() => signOut()}>Sign out</Subtle>
    </Screen>
  );
}
