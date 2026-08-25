import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  PhoneField,
  Subtle,
  formatMoney,
} from '@/components/ui-kit';
import { getServices, placeOrder, type PlaceOrderOptions } from '@/lib/api';
import {
  PAYMENT_LABELS,
  paymentSummaryLine,
  paymentToggleLabel,
} from '@/lib/domain/payment-summary';
import { estimateOrderTotal } from '@/lib/domain/pricing';
import {
  PAYMENT_METHODS,
  validateWalkIn,
  type Fulfillment,
  type PaymentMethod,
  type WalkInErrors,
} from '@/lib/domain/walk-in-order';
import type { OrderRow } from '@/lib/types';

type Props = {
  shopId: string;
  submitLabel: string;
  /** 'walk_in' adds POS intake fields (name, phone, fulfillment, payment). */
  mode?: 'customer' | 'walk_in';
  onSuccess: (order: OrderRow) => void;
};

export function ServiceOrderForm({ shopId, submitLabel, mode = 'customer', onSuccess }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState('');

  // Walk-in intake state (only rendered in walk_in mode).
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [fulfillment, setFulfillment] = useState<Fulfillment>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isPaid, setIsPaid] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<WalkInErrors>({});

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', shopId],
    queryFn: () => getServices(shopId),
  });

  const selectedItems = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([serviceId, quantity]) => ({ serviceId, quantity })),
    [quantities]
  );

  const estimate = useMemo(() => {
    if (!services || selectedItems.length === 0) return null;
    try {
      return estimateOrderTotal(services, selectedItems);
    } catch {
      return null;
    }
  }, [services, selectedItems]);

  const mutation = useMutation({
    mutationFn: (options: PlaceOrderOptions) =>
      placeOrder(
        shopId,
        selectedItems.map((item) => ({ service_id: item.serviceId, quantity: item.quantity })),
        options
      ),
    onSuccess,
    onError: (err: Error) => setError(err.message),
  });

  const handleSubmit = () => {
    setError('');
    setFieldErrors({});
    if (mode === 'customer') {
      mutation.mutate({});
      return;
    }
    const result = validateWalkIn({
      customerName,
      customerPhone,
      fulfillment,
      deliveryAddress,
      paymentMethod,
      isPaid,
    });
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    mutation.mutate({
      fulfillment: result.value.fulfillment,
      deliveryAddress: result.value.deliveryAddress,
      customerName: result.value.customerName,
      customerPhone: result.value.customerPhone,
      paymentMethod: result.value.paymentMethod,
      isPaid: result.value.isPaid,
    });
  };

  const adjust = (serviceId: string, step: number) => {
    setQuantities((prev) => ({
      ...prev,
      [serviceId]: Math.max(0, Math.round(((prev[serviceId] ?? 0) + step) * 10) / 10),
    }));
  };

  if (isLoading) return <Loading />;

  return (
    <>
      {mode === 'walk_in' && (
        <Card>
          <Text style={{ fontWeight: '600', fontSize: 16 }}>Customer</Text>
          <Field
            label="Name"
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Maria Santos"
          />
          <ErrorText>{fieldErrors.customerName}</ErrorText>
          <PhoneField
            label="Mobile number (optional)"
            value={customerPhone}
            onChangeText={setCustomerPhone}
          />
          <ErrorText>{fieldErrors.customerPhone}</ErrorText>

          <Text style={{ fontWeight: '600', marginTop: 4 }}>Pickup or delivery?</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['pickup', 'delivery'] as const).map((option) => (
              <View key={option} style={{ flex: 1 }}>
                <Button
                  title={option === 'pickup' ? 'Pickup' : 'Deliver'}
                  variant={fulfillment === option ? 'primary' : 'outline'}
                  onPress={() => setFulfillment(option)}
                />
              </View>
            ))}
          </View>
          {fulfillment === 'delivery' && (
            <>
              <Field
                label="Delivery address"
                value={deliveryAddress}
                onChangeText={setDeliveryAddress}
                placeholder="12 Mabini St, Quezon City"
              />
              <ErrorText>{fieldErrors.deliveryAddress}</ErrorText>
            </>
          )}
        </Card>
      )}

      {services?.length === 0 && (
        <EmptyState message="This shop has no services listed yet." />
      )}
      {services?.map((service) => {
        const qty = quantities[service.id] ?? 0;
        const step = service.unit === 'per_kg' ? 0.5 : 1;
        const unitLabel =
          service.unit === 'per_kg' ? '/kg' : service.unit === 'per_item' ? '/item' : ' flat';
        return (
          <Card key={service.id}>
            <Text style={{ fontWeight: '600', fontSize: 16 }}>{service.name}</Text>
            <Subtle>
              {formatMoney(service.price)}
              {unitLabel}
              {service.min_quantity > 0 ? ` · minimum ${service.min_quantity} kg applies` : ''}
            </Subtle>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Button title="−" variant="outline" onPress={() => adjust(service.id, -step)} />
              </View>
              <Text style={{ fontSize: 16, minWidth: 56, textAlign: 'center' }}>
                {qty}
                {service.unit === 'per_kg' ? ' kg' : ''}
              </Text>
              <View style={{ flex: 1 }}>
                <Button title="+" variant="outline" onPress={() => adjust(service.id, step)} />
              </View>
            </View>
          </Card>
        );
      })}
      {estimate && (
        <Card>
          <Text style={{ fontWeight: '700', fontSize: 18 }}>
            Estimated total: {formatMoney(estimate.total)}
          </Text>
          <Subtle>Final price is confirmed by the shop after weighing.</Subtle>
        </Card>
      )}

      {/* Payment sits right above Save so the owner confirms who paid at the
          moment they close the order, without scrolling back to the top. */}
      {mode === 'walk_in' && (
        <Card>
          <Text style={{ fontWeight: '600', fontSize: 16 }}>Payment</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PAYMENT_METHODS.map((method) => (
              <View key={method} style={{ minWidth: 90, flexGrow: 1 }}>
                <Button
                  title={PAYMENT_LABELS[method]}
                  variant={paymentMethod === method ? 'primary' : 'outline'}
                  onPress={() => setPaymentMethod(method)}
                />
              </View>
            ))}
          </View>
          <ErrorText>{fieldErrors.paymentMethod}</ErrorText>
          <Button
            title={paymentToggleLabel(isPaid, fulfillment)}
            variant={isPaid ? 'primary' : 'outline'}
            onPress={() => setIsPaid((paid) => !paid)}
          />
          <Subtle>
            {paymentSummaryLine({
              paymentMethod,
              isPaid,
              fulfillment,
              total: estimate?.total ?? 0,
            })}
          </Subtle>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      <Button
        title={mutation.isPending ? 'Submitting…' : submitLabel}
        onPress={handleSubmit}
        disabled={selectedItems.length === 0 || mutation.isPending}
      />
    </>
  );
}
