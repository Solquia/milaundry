import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  ErrorText,
  Field,
  Loading,
  STATUS_LABELS,
  Screen,
  StatusBadge,
  Subtle,
  Title,
  colors,
  formatDate,
  formatMoney,
} from '@/components/ui-kit';
import {
  addReview,
  choosePaymentMethod,
  getOrder,
  getOrderHistory,
  updateOrderStatus,
} from '@/lib/api';
import { bookingPaymentStage, canChoosePayment } from '@/lib/domain/booking-status';
import { PAYMENT_LABELS } from '@/lib/domain/payment-summary';
import {
  CUSTOMER_PAYMENT_METHODS,
  type PaymentMethod,
} from '@/lib/domain/walk-in-order';
import { supabase } from '@/lib/supabase';

export default function CustomerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  // Review prompt state (shown once the order is completed).
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hasReviewed, setHasReviewed] = useState(false);

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

  const paymentMutation = useMutation({
    mutationFn: (method: PaymentMethod) => choosePaymentMethod(id!, method),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['order', id] }),
    onError: (err: Error) => setError(err.message),
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      addReview({
        shopId: order!.shop_id,
        orderId: order!.id,
        rating,
        comment,
      }),
    onSuccess: () => setHasReviewed(true),
    onError: (err: Error) => setError(err.message),
  });

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

  const stage = bookingPaymentStage(order);

  return (
    <Screen>
      <Title>{order.shop?.name ?? 'Order'}</Title>
      <StatusBadge status={order.status} />

      {stage === 'awaiting_price' && (
        <View style={styles.bannerWaiting}>
          <Ionicons name="hourglass-outline" size={20} color="#B45309" />
          <Text style={styles.bannerWaitingText}>
            Booked! The shop will weigh your laundry and confirm the actual price.
          </Text>
        </View>
      )}
      {stage === 'price_confirmed' && (
        <View style={styles.bannerConfirmed}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#166534" />
          <Text style={styles.bannerConfirmedText}>
            Price confirmed: {formatMoney(order.final_total ?? 0)}. Choose how
            you&apos;d like to pay below.
          </Text>
        </View>
      )}

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

      {/* Pickup & delivery schedule for delivery bookings. */}
      {order.fulfillment === 'delivery' && (
        <Card>
          <Text style={{ fontWeight: '600' }}>Pickup & delivery</Text>
          {order.delivery_address ? <Subtle>{order.delivery_address}</Subtle> : null}
          {order.pickup_at ? (
            <Subtle>Pickup: {formatDate(order.pickup_at)}</Subtle>
          ) : null}
          {order.deliver_by ? (
            <Subtle>Deliver back by: {formatDate(order.deliver_by)}</Subtle>
          ) : null}
        </Card>
      )}

      {canChoosePayment(order) && (
        <Card>
          <Text style={{ fontWeight: '600', fontSize: 16 }}>How will you pay?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CUSTOMER_PAYMENT_METHODS.map((method) => (
              <View key={method} style={{ minWidth: 100, flexGrow: 1 }}>
                <Button
                  title={
                    method === 'cash'
                      ? order.fulfillment === 'delivery'
                        ? 'Cash on delivery'
                        : 'Cash at pickup'
                      : PAYMENT_LABELS[method]
                  }
                  variant={order.payment_method === method ? 'primary' : 'outline'}
                  onPress={() => paymentMutation.mutate(method)}
                />
              </View>
            ))}
          </View>
          <Subtle>
            Pay when your laundry is{' '}
            {order.fulfillment === 'delivery' ? 'delivered' : 'picked up'}, or settle
            GCash / Maya / bank transfer directly with the shop.
          </Subtle>
        </Card>
      )}
      {stage === 'paid' && (
        <Card>
          <Text style={{ fontWeight: '600', color: colors.success }}>
            Paid · {PAYMENT_LABELS[order.payment_method]}
            {order.paid_at ? ` · ${formatDate(order.paid_at)}` : ''}
          </Text>
        </Card>
      )}

      {/* Review prompt once the laundry journey is done. */}
      {order.status === 'completed' && !hasReviewed && (
        <Card>
          <Text style={{ fontWeight: '600', fontSize: 16 }}>
            How was {order.shop?.name ?? 'the shop'}?
          </Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                accessibilityRole="button"
                accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
                onPress={() => setRating(star)}
                hitSlop={6}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={28}
                  color={star <= rating ? '#F59E0B' : colors.subtle}
                />
              </Pressable>
            ))}
          </View>
          <Field
            label="Tell other customers about it (optional)"
            value={comment}
            onChangeText={setComment}
            placeholder="Clothes came back fresh and on time!"
            multiline
          />
          <Button
            title={reviewMutation.isPending ? 'Posting…' : 'Post review'}
            disabled={rating === 0 || reviewMutation.isPending}
            onPress={() => reviewMutation.mutate()}
          />
        </Card>
      )}
      {order.status === 'completed' && hasReviewed && (
        <Card>
          <Text style={{ fontWeight: '600', color: colors.success }}>
            Thanks for your review!
          </Text>
        </Card>
      )}

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

const styles = StyleSheet.create({
  bannerWaiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 12,
  },
  bannerWaitingText: { flex: 1, color: '#B45309', fontWeight: '600' },
  bannerConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: 12,
  },
  bannerConfirmedText: { flex: 1, color: '#166534', fontWeight: '600' },
});
