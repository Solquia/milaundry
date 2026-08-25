import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Share, Text, View } from 'react-native';
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
  Tag,
  Title,
  colors,
  formatMoney,
} from '@/components/ui-kit';
import { getOrder, markOrderPaid, updateOrderStatus } from '@/lib/api';
import { ORDER_STATUSES, nextStatuses, type OrderStatus } from '@/lib/domain/order-status';
import { orderTags } from '@/lib/domain/order-tags';
import { buildOrderQr } from '@/lib/domain/qr';

/** The forward pipeline shown in the stage tracker (cancel handled separately). */
const PIPELINE: readonly OrderStatus[] = ORDER_STATUSES.filter(
  (status) => status !== 'pending' && status !== 'cancelled'
);

function StageTracker({ status }: { status: OrderStatus }) {
  if (status === 'cancelled') return null;
  const currentIndex = PIPELINE.indexOf(status);
  return (
    <Card>
      <Text style={{ fontWeight: '600' }}>Washing cycle</Text>
      {PIPELINE.map((stage, index) => {
        const isDone = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <View key={stage} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 16, width: 24, textAlign: 'center' }}>
              {isDone ? '✓' : isCurrent ? '●' : '○'}
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: isCurrent ? colors.text : colors.subtle,
                fontWeight: isCurrent ? '700' : '400',
              }}
            >
              {STATUS_LABELS[stage]}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

export default function MerchantOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: Boolean(id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['order', id] });
    queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
  };

  const handleTransition = async (to: OrderStatus) => {
    if (!id) return;
    setError('');
    try {
      await updateOrderStatus(id, to);
      refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const handleMarkPaid = async () => {
    if (!id) return;
    setError('');
    try {
      await markOrderPaid(id);
      refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  if (isLoading || !order) return <Loading />;

  const qrValue = buildOrderQr(order.id, order.claim_token);
  const advance = nextStatuses(order.status);

  return (
    <Screen>
      <Title>Order #{order.id.slice(0, 8)}</Title>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <StatusBadge status={order.status} />
        {orderTags(order).map((tag) => (
          <Tag key={tag} label={tag} />
        ))}
      </View>

      <Card>
        <Text style={{ fontWeight: '600' }}>Customer</Text>
        <Text style={{ fontSize: 18, fontWeight: '700' }}>
          {order.customer_name || 'Walk-in customer'}
        </Text>
        {order.customer_phone ? (
          <Text
            style={{ fontSize: 16, color: colors.primary, fontWeight: '600' }}
            onPress={() => Linking.openURL(`tel:${order.customer_phone}`)}
            accessibilityRole="link"
          >
            {order.customer_phone} · call
          </Text>
        ) : (
          <Subtle>No contact number on file</Subtle>
        )}
        {order.fulfillment === 'delivery' && (
          <Subtle>Deliver to: {order.delivery_address || '—'}</Subtle>
        )}
        {order.notes ? <Subtle>Notes: {order.notes}</Subtle> : null}
      </Card>

      <StageTracker status={order.status} />

      <Card>
        <Text style={{ fontWeight: '600' }}>Services</Text>
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

      <Card>
        <Text style={{ fontWeight: '600' }}>Payment</Text>
        <Subtle>
          {order.payment_method.toUpperCase()} ·{' '}
          {order.payment_status === 'paid' ? 'paid' : 'to collect'}
        </Subtle>
        {order.payment_status === 'unpaid' && order.status !== 'cancelled' && (
          <Button title="Mark as paid" onPress={handleMarkPaid} />
        )}
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
      {advance.map((to) => (
        <Button
          key={to}
          title={to === 'cancelled' ? 'Cancel order' : `Mark as ${STATUS_LABELS[to]}`}
          variant={to === 'cancelled' ? 'danger' : 'primary'}
          onPress={() => handleTransition(to)}
        />
      ))}
    </Screen>
  );
}
