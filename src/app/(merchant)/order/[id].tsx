import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Share, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

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
  formatMoney,
} from '@/components/ui-kit';
import { getOrder, updateOrderStatus } from '@/lib/api';
import { nextStatuses, type OrderStatus } from '@/lib/domain/order-status';
import { buildOrderQr } from '@/lib/domain/qr';

export default function MerchantOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: Boolean(id),
  });

  const handleTransition = async (to: OrderStatus) => {
    if (!id) return;
    setError('');
    try {
      await updateOrderStatus(id, to);
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  if (isLoading || !order) return <Loading />;

  const qrValue = buildOrderQr(order.id, order.claim_token);

  return (
    <Screen>
      <Title>Order #{order.id.slice(0, 8)}</Title>
      <StatusBadge status={order.status} />
      <Card>
        {order.order_items.map((item) => (
          <View key={item.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>
              {item.service_name} × {item.quantity}
              {item.unit === 'per_kg' ? ' kg' : ''}
            </Text>
            <Text>{formatMoney(item.subtotal)}</Text>
          </View>
        ))}
        <Text style={{ fontWeight: '700', fontSize: 16 }}>
          Total: {formatMoney(order.final_total ?? order.estimated_total)}
        </Text>
      </Card>

      {order.customer_id === null && (
        <Card>
          <Text style={{ fontWeight: '600' }}>Customer claim QR</Text>
          <Subtle>
            Let the customer scan this code (or send it) to register with your shop and track this
            order.
          </Subtle>
          <View style={{ alignItems: 'center', padding: 12 }}>
            <QRCode value={qrValue} size={200} />
          </View>
          <Button
            title="Share link"
            variant="outline"
            onPress={() => Share.share({ message: qrValue })}
          />
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      {nextStatuses(order.status).map((to) => (
        <Button
          key={to}
          title={`Mark as ${STATUS_LABELS[to]}`}
          variant={to === 'cancelled' ? 'danger' : 'primary'}
          onPress={() => handleTransition(to)}
        />
      ))}
    </Screen>
  );
}
