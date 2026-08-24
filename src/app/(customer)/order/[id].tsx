import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  Card,
  ErrorText,
  Loading,
  STATUS_LABELS,
  Screen,
  StatusBadge,
  Subtle,
  Title,
  formatDate,
  formatMoney,
} from '@/components/ui-kit';
import { getOrder, getOrderHistory, updateOrderStatus } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function CustomerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: Boolean(id),
  });

  const { data: history } = useQuery({
    queryKey: ['order-history', id],
    queryFn: () => getOrderHistory(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['order', id] });
          queryClient.invalidateQueries({ queryKey: ['order-history', id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  const handleCancel = async () => {
    if (!id) return;
    setError('');
    try {
      await updateOrderStatus(id, 'cancelled');
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    }
  };

  if (isLoading || !order) return <Loading />;

  return (
    <Screen>
      <Title>{order.shop?.name ?? 'Order'}</Title>
      <StatusBadge status={order.status} />
      <Card>
        {order.order_items.map((item) => (
          <View
            key={item.id}
            style={{ flexDirection: 'row', justifyContent: 'space-between' }}
          >
            <Text>
              {item.service_name} × {item.quantity}
              {item.unit === 'per_kg' ? ' kg' : ''}
            </Text>
            <Text>{formatMoney(item.subtotal)}</Text>
          </View>
        ))}
        <Text style={{ fontWeight: '700', fontSize: 16 }}>
          Total: {formatMoney(order.final_total ?? order.estimated_total)}
          {order.final_total === null ? ' (estimated)' : ''}
        </Text>
      </Card>
      {history && history.length > 0 && (
        <Card>
          <Text style={{ fontWeight: '600' }}>Status history</Text>
          {history.map((entry) => (
            <Subtle key={entry.id}>
              {STATUS_LABELS[entry.to_status]} · {formatDate(entry.created_at)}
            </Subtle>
          ))}
        </Card>
      )}
      <ErrorText>{error}</ErrorText>
      {order.status === 'pending' && (
        <Button title="Cancel order" variant="danger" onPress={handleCancel} />
      )}
    </Screen>
  );
}
