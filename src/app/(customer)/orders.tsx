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
import { getMyOrders } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function CustomerOrders() {
  const { signOut } = useAuth();
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['my-orders'],
    queryFn: getMyOrders,
  });

  if (isLoading) return <Loading />;

  return (
    <Screen>
      {error ? <ErrorText>{error.message}</ErrorText> : null}
      {orders?.length === 0 && (
        <EmptyState message="No laundry yet. Scan a shop QR to get started, or create a new order from a registered shop." />
      )}
      {orders?.map((order) => (
        <Link key={order.id} href={`/(customer)/order/${order.id}`} asChild>
          <View>
            <Card>
              <Text style={{ fontWeight: '600', fontSize: 16 }}>
                {order.shop?.name ?? 'Laundry shop'}
              </Text>
              <StatusBadge status={order.status} />
              <Subtle>
                {formatMoney(order.final_total ?? order.estimated_total)} ·{' '}
                {formatDate(order.created_at)}
              </Subtle>
            </Card>
          </View>
        </Link>
      ))}
      <Subtle onPress={() => signOut()}>Sign out</Subtle>
    </Screen>
  );
}
