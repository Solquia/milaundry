import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  ErrorText,
  Field,
  Loading,
  Screen,
  Subtle,
  colors,
  formatMoney,
} from '@/components/ui-kit';
import { getServices, placeOrder } from '@/lib/api';
import {
  MAX_WEIGHT_KG,
  WEIGHT_STEP_KG,
  buildBookingItems,
  clampWeight,
  estimateBooking,
  type AddOnQuantities,
} from '@/lib/domain/booking-estimate';
import {
  validateBookingSchedule,
  type BookingScheduleErrors,
} from '@/lib/domain/booking-schedule';
import type { Fulfillment } from '@/lib/domain/walk-in-order';

const QUICK_WEIGHTS_KG = [3, 5, 8, 12];
const SLOT_HOURS = [8, 10, 12, 14, 16, 18];
const DAY_MS = 24 * 60 * 60 * 1000;

/** A concrete Date from "N days from today at H o'clock". */
function slotDate(dayOffset: number, hour: number): Date {
  const date = new Date(Date.now() + dayOffset * DAY_MS);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function dayLabel(offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return new Date(Date.now() + offset * DAY_MS).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function hourLabel(hour: number): string {
  const meridiem = hour >= 12 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${meridiem}`;
}

type SlotValue = { dayOffset: number; hour: number };

function SlotPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SlotValue;
  onChange: (next: SlotValue) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {[0, 1, 2, 3].map((offset) => (
          <Chip
            key={offset}
            label={dayLabel(offset)}
            isSelected={value.dayOffset === offset}
            onPress={() => onChange({ ...value, dayOffset: offset })}
          />
        ))}
      </View>
      <View style={styles.chipRow}>
        {SLOT_HOURS.map((hour) => (
          <Chip
            key={hour}
            label={hourLabel(hour)}
            isSelected={value.hour === hour}
            onPress={() => onChange({ ...value, hour })}
          />
        ))}
      </View>
    </View>
  );
}

function Chip({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.chip, isSelected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function BookService() {
  const { serviceId, shopId } = useLocalSearchParams<{
    serviceId: string;
    shopId: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<'estimate' | 'schedule'>('estimate');
  const [weightKg, setWeightKg] = useState(0);
  const [addOns, setAddOns] = useState<AddOnQuantities>({});
  const [error, setError] = useState('');

  // Schedule step state, seeded with a sensible default window.
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [pickupSlot, setPickupSlot] = useState<SlotValue>({ dayOffset: 0, hour: 16 });
  const [deliverSlot, setDeliverSlot] = useState<SlotValue>({ dayOffset: 1, hour: 16 });
  const [fieldErrors, setFieldErrors] = useState<BookingScheduleErrors>({});

  const { data: services, isLoading } = useQuery({
    queryKey: ['services', shopId],
    queryFn: () => getServices(shopId!),
    enabled: Boolean(shopId),
  });

  const service = services?.find((row) => row.id === serviceId);
  const isPerKg = service?.unit === 'per_kg';

  /** Heavy/thick extras: the shop's bedding & heavy items, minus the main service. */
  const heavyExtras = useMemo(
    () =>
      services?.filter(
        (row) => row.category === 'special_items' && row.id !== serviceId
      ) ?? [],
    [services, serviceId]
  );

  const estimate = useMemo(() => {
    if (!services || !serviceId) return null;
    return estimateBooking(services, serviceId, weightKg, addOns);
  }, [services, serviceId, weightKg, addOns]);

  const mutation = useMutation({
    mutationFn: (schedule: {
      fulfillment: Fulfillment;
      deliveryAddress: string;
      pickupAt: Date | null;
      deliverBy: Date | null;
    }) =>
      placeOrder(
        shopId!,
        buildBookingItems(serviceId!, weightKg, addOns).map((item) => ({
          service_id: item.serviceId,
          quantity: item.quantity,
        })),
        schedule
      ),
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      router.replace(`/(customer)/order/${order.id}`);
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleBook = () => {
    setError('');
    setFieldErrors({});
    const result = validateBookingSchedule(
      {
        fulfillment,
        deliveryAddress,
        pickupAt: slotDate(pickupSlot.dayOffset, pickupSlot.hour),
        deliverBy: slotDate(deliverSlot.dayOffset, deliverSlot.hour),
      },
      new Date()
    );
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    mutation.mutate(result.value);
  };

  if (isLoading) return <Loading />;
  if (!service) {
    return (
      <Screen>
        <ErrorText>Service not found. Go back and pick another service.</ErrorText>
      </Screen>
    );
  }

  const hasSelection = weightKg > 0 || Object.values(addOns).some((qty) => qty > 0);

  return (
    <Screen>
      <Card>
        <Text style={styles.serviceName}>{service.name}</Text>
        <Subtle>
          {formatMoney(service.price)}
          {service.unit === 'per_kg' ? '/kg' : service.unit === 'per_item' ? '/item' : ' flat'}
          {service.min_quantity > 0 ? ` · ${service.min_quantity} kg minimum` : ''}
        </Subtle>
      </Card>

      {step === 'estimate' && (
        <>
          {/* The "scale": estimate how heavy the laundry is. */}
          <Card>
            <Text style={styles.sectionTitle}>
              {isPerKg ? 'How heavy is your laundry?' : 'How many?'}
            </Text>
            <View style={styles.scaleRow}>
              <Button
                title="−"
                variant="outline"
                onPress={() =>
                  setWeightKg((kg) => clampWeight(kg - (isPerKg ? WEIGHT_STEP_KG : 1)))
                }
              />
              <View style={styles.scaleReadout}>
                <Ionicons name="scale-outline" size={22} color={colors.primary} />
                <Text style={styles.scaleValue}>
                  {weightKg}
                  {isPerKg ? ' kg' : ''}
                </Text>
              </View>
              <Button
                title="+"
                variant="outline"
                onPress={() =>
                  setWeightKg((kg) => clampWeight(kg + (isPerKg ? WEIGHT_STEP_KG : 1)))
                }
              />
            </View>
            {isPerKg && (
              <View style={styles.chipRow}>
                {QUICK_WEIGHTS_KG.map((kg) => (
                  <Chip
                    key={kg}
                    label={`${kg} kg`}
                    isSelected={weightKg === kg}
                    onPress={() => setWeightKg(kg)}
                  />
                ))}
              </View>
            )}
            {isPerKg && (
              <Subtle>
                A full laundry basket is around 5 kg. Max {MAX_WEIGHT_KG} kg per booking.
              </Subtle>
            )}
          </Card>

          {heavyExtras.length > 0 && (
            <Card>
              <Text style={styles.sectionTitle}>Thick or heavy items?</Text>
              <Subtle>Comforters, beddings, and curtains are priced separately.</Subtle>
              {heavyExtras.map((extra) => {
                const qty = addOns[extra.id] ?? 0;
                return (
                  <View key={extra.id} style={styles.extraRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.extraName}>{extra.name}</Text>
                      <Subtle>
                        {formatMoney(extra.price)}
                        {extra.unit === 'per_kg' ? '/kg' : '/item'}
                      </Subtle>
                    </View>
                    <Button
                      title="−"
                      variant="outline"
                      onPress={() =>
                        setAddOns((prev) => ({
                          ...prev,
                          [extra.id]: Math.max(0, qty - 1),
                        }))
                      }
                    />
                    <Text style={styles.extraQty}>{qty}</Text>
                    <Button
                      title="+"
                      variant="outline"
                      onPress={() =>
                        setAddOns((prev) => ({ ...prev, [extra.id]: qty + 1 }))
                      }
                    />
                  </View>
                );
              })}
            </Card>
          )}

          {estimate && (
            <Card>
              <Text style={styles.estimateTotal}>
                Estimated price: {formatMoney(estimate.total)}
              </Text>
              <Subtle>
                Estimate only — the shop weighs your laundry and confirms the actual
                price before you pay.
              </Subtle>
            </Card>
          )}

          <Button
            title="Proceed"
            disabled={!hasSelection}
            onPress={() => setStep('schedule')}
          />
        </>
      )}

      {step === 'schedule' && (
        <>
          <Card>
            <Text style={styles.sectionTitle}>How will we get your laundry?</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Pick up & deliver"
                  variant={fulfillment === 'delivery' ? 'primary' : 'outline'}
                  onPress={() => setFulfillment('delivery')}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="I'll drop it off"
                  variant={fulfillment === 'pickup' ? 'primary' : 'outline'}
                  onPress={() => setFulfillment('pickup')}
                />
              </View>
            </View>

            {fulfillment === 'delivery' ? (
              <>
                <Field
                  label="Pickup & delivery address"
                  value={deliveryAddress}
                  onChangeText={setDeliveryAddress}
                  placeholder="12 Mabini St, Quezon City"
                />
                <ErrorText>{fieldErrors.deliveryAddress}</ErrorText>
                <SlotPicker
                  label="Pick up my laundry"
                  value={pickupSlot}
                  onChange={(next) => {
                    setPickupSlot(next);
                    // Keep the delivery promise a day after pickup by default.
                    setDeliverSlot((current) =>
                      current.dayOffset <= next.dayOffset
                        ? { dayOffset: next.dayOffset + 1, hour: current.hour }
                        : current
                    );
                  }}
                />
                <ErrorText>{fieldErrors.pickupAt}</ErrorText>
                <SlotPicker
                  label="Deliver it back by"
                  value={deliverSlot}
                  onChange={setDeliverSlot}
                />
                <ErrorText>{fieldErrors.deliverBy}</ErrorText>
              </>
            ) : (
              <Subtle>
                Bring your laundry to the shop and pick it up yourself once it&apos;s
                ready — no schedule needed.
              </Subtle>
            )}
          </Card>

          {estimate && (
            <Card>
              <Text style={styles.estimateTotal}>
                Estimated price: {formatMoney(estimate.total)}
              </Text>
              <Subtle>
                After booking, the shop weighs your laundry and confirms the actual
                price. You choose how to pay then — cash on delivery, GCash, Maya, or
                bank transfer.
              </Subtle>
            </Card>
          )}

          <ErrorText>{error}</ErrorText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title="Back" variant="outline" onPress={() => setStep('estimate')} />
            </View>
            <View style={{ flex: 2 }}>
              <Button
                title={mutation.isPending ? 'Booking…' : 'Book now'}
                disabled={mutation.isPending}
                onPress={handleBook}
              />
            </View>
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  serviceName: { fontSize: 20, fontWeight: '700', color: colors.text },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text },
  scaleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  scaleReadout: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 14,
  },
  scaleValue: { fontSize: 24, fontWeight: '800', color: colors.primaryDark },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.card,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.subtle },
  chipTextSelected: { color: '#FFFFFF' },
  pickerLabel: { fontSize: 13, fontWeight: '600', color: colors.subtle },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  extraName: { fontSize: 14, fontWeight: '600', color: colors.text },
  extraQty: { fontSize: 16, minWidth: 28, textAlign: 'center' },
  estimateTotal: { fontSize: 18, fontWeight: '700', color: colors.text },
});
