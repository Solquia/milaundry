import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import { PieceCounter, WeightScale } from '@/components/quantity-picker';
import { Reveal } from '@/components/reveal';
import { SlotCalendar } from '@/components/slot-calendar';
import { StepRail } from '@/components/step-rail';
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
  space,
  type,
} from '@/components/ui-kit';
import { getServices, placeOrder } from '@/lib/api';
import {
  MAX_WEIGHT_KG,
  buildBookingItems,
  clampWeight,
  estimateBooking,
  type AddOnQuantities,
} from '@/lib/domain/booking-estimate';
import {
  describeCatalogProblem,
  friendlyBookingError,
  type CatalogProblem,
} from '@/lib/domain/booking-error';
import {
  validateBookingSchedule,
  type BookingScheduleErrors,
} from '@/lib/domain/booking-schedule';
import { previousStep } from '@/lib/domain/step-rail';
import {
  formatPriceLine,
  formatQuantity,
  minimumChargeNotice,
} from '@/lib/domain/price-label';
import type { OrderEstimate } from '@/lib/domain/pricing';
import {
  BOOKING_WINDOW_DAYS,
  keepDeliveryAfterPickup,
  slotSummary,
  turnaroundLabel,
  turnaroundNote,
  type Slot,
} from '@/lib/domain/booking-slot';
import type { Fulfillment } from '@/lib/domain/walk-in-order';

const QUICK_WEIGHTS_KG = [3, 5, 8, 12];
const DAY_MS = 24 * 60 * 60 * 1000;

/** A concrete Date from "N days from today at H o'clock". */
function slotDate(dayOffset: number, hour: number): Date {
  const date = new Date(Date.now() + dayOffset * DAY_MS);
  date.setHours(hour, 0, 0, 0);
  return date;
}

type SlotValue = Slot;
type LegName = 'pickup' | 'deliver';
type Step = 'items' | 'schedule' | 'review';

/**
 * The three questions, in the order a counter asks them. Declared once so the
 * rail, the Back button and the footer all count the same steps.
 */
const BOOKING_STEPS = [
  { key: 'items', label: 'Items' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'review', label: 'Review' },
] as const satisfies readonly { key: Step; label: string }[];

/**
 * One leg of the schedule: a settled answer you can open if it is wrong.
 *
 * Both legs used to stand open at once — four day chips and six hour chips,
 * twice, twenty chips on a step whose defaults were already right for most
 * bookings. The customer read a wall to confirm something they agreed with.
 *
 * Now each leg is a single line that states its own answer, and the chips sit
 * behind it. Only one leg opens at a time, so the most that can ever be on
 * screen is ten chips belonging to one question.
 */
function ScheduleLeg({
  label,
  icon,
  value,
  minOffset,
  isOpen,
  onToggle,
  onChange,
}: {
  label: string;
  icon: string;
  value: SlotValue;
  /** Earliest day this leg offers. Delivery counts from pickup, not today. */
  minOffset: number;
  isOpen: boolean;
  onToggle: () => void;
  onChange: (next: SlotValue) => void;
}) {
  const now = new Date();
  const summary = slotSummary(value, now);

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        // Two texts on screen, one fact when spoken.
        accessibilityLabel={`${label}: ${summary}`}
        accessibilityHint={
          isOpen ? 'Closes the day and time choices' : 'Opens the day and time choices'
        }
        onPress={onToggle}
        style={[styles.legRow, isOpen && styles.legRowOpen]}
      >
        <Ionicons name={icon as never} size={18} color={colors.actionInk} />
        <Text style={styles.legLabel}>{label}</Text>
        <Text style={styles.legValue}>{summary}</Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.subtle}
        />
      </Pressable>

      {isOpen && (
        <Reveal style={styles.legPanel}>
          <SlotCalendar
            label={label}
            value={value}
            onChange={onChange}
            minOffset={minOffset}
            maxOffset={minOffset + BOOKING_WINDOW_DAYS}
            now={now}
          />
        </Reveal>
      )}
    </View>
  );
}

function Chip({
  label,
  isSelected,
  onPress,
  style,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      style={[styles.chip, isSelected && styles.chipSelected, style]}
    >
      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The one screen a customer sees when booking cannot start. Each cause carries
 * its own sentence, and only a recoverable one offers a retry.
 */
function BookingProblem({
  problem,
  onRetry,
  onBack,
}: {
  problem: CatalogProblem;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <Screen>
      <Card>
        <Text style={styles.sectionTitle}>{problem.title}</Text>
        <Subtle>{problem.body}</Subtle>
      </Card>
      {problem.canRetry && <Button title="Try again" onPress={onRetry} />}
      <Button title="Back to the shop" variant="outline" onPress={onBack} />
    </Screen>
  );
}

/** One settled fact on the review: what it is called, and what it says. */
function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

function priceAmount(estimate: OrderEstimate | null, hasSelection: boolean): string {
  if (estimate) return formatMoney(estimate.total);
  return hasSelection ? '—' : formatMoney(0);
}

/**
 * The one line under the figure. It advances with the step rather than
 * repeating: the schedule step used to restate the estimate step's sentence
 * word for word, directly below a card that said it a third time.
 */
function priceNote(
  estimate: OrderEstimate | null,
  hasSelection: boolean,
  step: Step
): string {
  if (estimate) {
    return step === 'items'
      ? 'Final price confirmed after the shop weighs your laundry.'
      : 'Pay after the shop weighs it — cash, GCash, Maya, or bank transfer.';
  }
  if (hasSelection) {
    return "This shop's price list may have just changed — pick your items again.";
  }
  return 'Add items to see your estimate.';
}

/**
 * The running total, pinned in the screen footer. One shape across all three
 * states: the figure keeps a fixed home so the layout never jumps, and an
 * unpriceable selection reads as unknown rather than as free.
 */
function PriceSummary({
  estimate,
  hasSelection,
  step,
}: {
  estimate: OrderEstimate | null;
  hasSelection: boolean;
  step: Step;
}) {
  return (
    <>
      <View style={styles.priceRow}>
        <Text style={styles.priceLabel}>Estimated price</Text>
        <Text style={[styles.priceValue, !estimate && styles.priceValueMuted]}>
          {priceAmount(estimate, hasSelection)}
        </Text>
      </View>
      <Text style={styles.priceNote}>{priceNote(estimate, hasSelection, step)}</Text>
    </>
  );
}

export default function BookService() {
  const { serviceId, shopId } = useLocalSearchParams<{
    serviceId: string;
    shopId: string;
  }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>('items');
  const [weightKg, setWeightKg] = useState(0);
  const [addOns, setAddOns] = useState<AddOnQuantities>({});
  const [error, setError] = useState('');

  // Schedule step state, seeded with a sensible default window.
  const [fulfillment, setFulfillment] = useState<Fulfillment>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [pickupSlot, setPickupSlot] = useState<SlotValue>({ dayOffset: 0, hour: 16 });
  const [deliverSlot, setDeliverSlot] = useState<SlotValue>({ dayOffset: 1, hour: 16 });
  /** Which leg is open for editing. Null — the default — is both settled. */
  const [openLeg, setOpenLeg] = useState<LegName | null>('pickup');
  const [fieldErrors, setFieldErrors] = useState<BookingScheduleErrors>({});

  const {
    data: services,
    isLoading,
    error: loadError,
    refetch,
  } = useQuery({
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

  /**
   * The booking said back as lines: what, how much of it, and what that costs.
   * Built from the same `buildBookingItems` the order is placed with, so the
   * review cannot quietly disagree with what is sent.
   */
  const reviewLines = useMemo(() => {
    if (!services || !serviceId) return [];
    return buildBookingItems(serviceId, weightKg, addOns).map((item) => {
      const row = services.find((entry) => entry.id === item.serviceId);
      return {
        id: item.serviceId,
        name: row?.name ?? 'Item',
        meta: row ? `${formatQuantity(row.unit, item.quantity)} · ${formatPriceLine(row)}` : '',
        subtotal:
          estimate?.lines.find((line) => line.serviceId === item.serviceId)?.subtotal ?? null,
      };
    });
  }, [services, serviceId, weightKg, addOns, estimate]);

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
    onError: (err: Error) => setError(friendlyBookingError(err.message)),
  });

  /**
   * The schedule, checked. Returns null and opens the leg that is wrong — an
   * error under a closed row is an error nobody can act on.
   */
  const settledSchedule = () => {
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
      if (result.errors.pickupAt) setOpenLeg('pickup');
      else if (result.errors.deliverBy) setOpenLeg('deliver');
      return null;
    }
    setFieldErrors({});
    return result.value;
  };

  const goToReview = () => {
    setError('');
    if (settledSchedule()) setStep('review');
  };

  const handleBook = () => {
    setError('');
    const schedule = settledSchedule();
    // A schedule can go stale while the review sits open. Send the customer to
    // the step that can fix it rather than failing under the last button.
    if (!schedule) {
      setStep('schedule');
      return;
    }
    mutation.mutate(schedule);
  };

  if (isLoading) return <Loading />;

  const problem = describeCatalogProblem({
    hasShopId: Boolean(shopId),
    loadError,
    isServiceFound: Boolean(service),
  });

  if (problem) {
    return (
      <BookingProblem
        problem={problem}
        onRetry={() => void refetch()}
        onBack={() => router.back()}
      />
    );
  }

  // Unreachable: describeCatalogProblem always reports a missing service above.
  if (!service) return null;

  const hasSelection = weightKg > 0 || Object.values(addOns).some((qty) => qty > 0);
  const mainMinimumNotice = minimumChargeNotice(service, weightKg);

  /** Where Back goes. Null on the first step, which is why it is not drawn. */
  const back = previousStep(BOOKING_STEPS, step);

  const footer = (
    <>
      <PriceSummary estimate={estimate} hasSelection={hasSelection} step={step} />
      <ErrorText>{error}</ErrorText>
      <View style={styles.commitRow}>
        {back && (
          <View style={{ flex: 1 }}>
            <Button title="Back" variant="outline" onPress={() => setStep(back)} />
          </View>
        )}
        <View style={{ flex: 2 }}>
          {step === 'review' ? (
            <Button
              title={mutation.isPending ? 'Placing…' : 'Place order'}
              disabled={mutation.isPending}
              onPress={handleBook}
            />
          ) : (
            <Button
              title="Continue"
              disabled={!hasSelection}
              onPress={step === 'items' ? () => setStep('schedule') : goToReview}
            />
          )}
        </View>
      </View>
    </>
  );

  return (
    <Screen footer={footer}>
      {/* Identity, not a decision — so it reads as a header, not as the first card. */}
      <View style={styles.header}>
        {/* Numbered and named, not two anonymous bars: a first-time customer
            needs to know how many questions are left and what they will ask,
            and that a question already answered is still theirs to change. */}
        <StepRail steps={BOOKING_STEPS} current={step} onGo={setStep} />
        <Text style={styles.serviceName}>{service.name}</Text>
        <Text style={styles.servicePrice}>{formatPriceLine(service)}</Text>
      </View>

      {step === 'items' && (
        <View style={styles.sections}>
          {/* The "scale": estimate how heavy the laundry is. */}
          <Card>
            <Text style={styles.sectionTitle}>
              {isPerKg ? 'How heavy is your laundry?' : 'How many pieces?'}
            </Text>
            {isPerKg ? (
              <>
                <WeightScale valueKg={weightKg} onChange={setWeightKg} />
                <View style={styles.chipGrid}>
                  {QUICK_WEIGHTS_KG.map((kg) => (
                    <Chip
                      key={kg}
                      label={`${kg} kg`}
                      isSelected={weightKg === kg}
                      onPress={() => setWeightKg(clampWeight(kg))}
                      style={styles.quickChip}
                    />
                  ))}
                </View>
                <Subtle>
                  Drag the scale, or tap a size. A full laundry basket is around 5 kg —
                  max {MAX_WEIGHT_KG} kg per booking.
                </Subtle>
              </>
            ) : (
              <PieceCounter
                value={weightKg}
                onChange={setWeightKg}
                label={service.name}
              />
            )}
            {mainMinimumNotice && (
              <Text style={styles.noticeText}>{mainMinimumNotice}</Text>
            )}
          </Card>

          {heavyExtras.length > 0 && (
            <Card>
              <Text style={styles.sectionTitle}>Add thick or heavy items</Text>
              <Subtle>
                Comforters, beddings, and curtains are priced separately. Skip this if
                you have none.
              </Subtle>
              {heavyExtras.map((extra) => {
                const qty = addOns[extra.id] ?? 0;
                const notice = minimumChargeNotice(extra, qty);
                const setQty = (next: number) =>
                  setAddOns((prev) => ({ ...prev, [extra.id]: next }));
                return (
                  <View key={extra.id} style={styles.extraBlock}>
                    <View style={styles.extraHeading}>
                      <Text style={styles.extraName}>{extra.name}</Text>
                      {qty > 0 && (
                        <Text style={styles.extraCount}>
                          {formatQuantity(extra.unit, qty)}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.extraPrice}>{formatPriceLine(extra)}</Text>
                    {extra.unit === 'per_kg' ? (
                      <WeightScale valueKg={qty} onChange={setQty} />
                    ) : (
                      <PieceCounter
                        value={qty}
                        onChange={setQty}
                        label={extra.name}
                        compact
                      />
                    )}
                    {notice && <Text style={styles.noticeText}>{notice}</Text>}
                  </View>
                );
              })}
            </Card>
          )}

        </View>
      )}

      {step === 'schedule' && (
        <View style={styles.sections}>
          <Card>
            <Text style={styles.sectionTitle}>How will we get your laundry?</Text>
            <View style={styles.commitRow}>
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

                {/* Two settled rows, not two open pickers. The schedule already
                    has a good answer; this states it and gets out of the way. */}
                <View style={styles.legGroup}>
                  <ScheduleLeg
                    label="Pickup"
                    icon="arrow-up-circle-outline"
                    value={pickupSlot}
                    minOffset={0}
                    isOpen={openLeg === 'pickup'}
                    onToggle={() =>
                      setOpenLeg((open) => (open === 'pickup' ? null : 'pickup'))
                    }
                    onChange={(next) => {
                      setPickupSlot(next);
                      setDeliverSlot((current) => keepDeliveryAfterPickup(current, next));
                    }}
                  />
                  <View style={styles.legSeam} />
                  <ScheduleLeg
                    label="Delivered back"
                    icon="arrow-down-circle-outline"
                    value={deliverSlot}
                    minOffset={pickupSlot.dayOffset}
                    isOpen={openLeg === 'deliver'}
                    onToggle={() =>
                      setOpenLeg((open) => (open === 'deliver' ? null : 'deliver'))
                    }
                    onChange={setDeliverSlot}
                  />
                </View>

                {/* The wait belongs to the pair, so it is said beneath the pair —
                    once, instead of as a note hanging off the second leg. */}
                <View style={styles.turnaroundRow}>
                  <Text style={styles.turnaroundLabel}>
                    {turnaroundLabel(pickupSlot, deliverSlot)}
                  </Text>
                  <Text style={styles.turnaroundNote}>
                    {turnaroundNote(pickupSlot, deliverSlot)}
                  </Text>
                </View>

                <ErrorText>{fieldErrors.pickupAt}</ErrorText>
                <ErrorText>{fieldErrors.deliverBy}</ErrorText>
              </>
            ) : (
              <Subtle>
                Bring your laundry to the shop and pick it up yourself once it&apos;s
                ready — no schedule needed.
              </Subtle>
            )}
          </Card>
        </View>
      )}

      {step === 'review' && (
        <View style={styles.sections}>
          <Card>
            <Text style={styles.sectionTitle}>Your laundry</Text>
            {reviewLines.map((line) => (
              <View key={line.id} style={styles.reviewLine}>
                <View style={styles.reviewLineText}>
                  <Text style={styles.reviewName}>{line.name}</Text>
                  <Text style={styles.reviewMeta}>{line.meta}</Text>
                </View>
                {/* An unpriceable line reads as unknown, never as free. */}
                <Text style={styles.reviewAmount}>
                  {line.subtotal === null ? '—' : formatMoney(line.subtotal)}
                </Text>
              </View>
            ))}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>
              {fulfillment === 'delivery' ? 'Pickup & delivery' : 'Drop-off'}
            </Text>
            {fulfillment === 'delivery' ? (
              <>
                <ReviewRow label="Pickup" value={slotSummary(pickupSlot, new Date())} />
                <ReviewRow
                  label="Delivered back"
                  value={slotSummary(deliverSlot, new Date())}
                />
                <ReviewRow label="Address" value={deliveryAddress} />
              </>
            ) : (
              <Subtle>
                Bring your laundry to the shop and pick it up yourself once it&apos;s
                ready — no schedule needed.
              </Subtle>
            )}
          </Card>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Identity block. Sits above the first card, so the first bordered surface
  // the eye lands on is a decision rather than a restatement of the title.
  header: { gap: space.snug, paddingTop: space.tight },
  serviceName: { ...type.title, color: colors.text },
  servicePrice: { ...type.body, color: colors.subtle },

  /** Sections breathe wider than the rows inside them: 20 against 12 and 8. */
  sections: { gap: space.section },
  sectionTitle: { ...type.section, color: colors.text },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  /** Four quick sizes on one row, so none strands alone on a second line. */
  quickChip: { flexBasis: '22%', flexGrow: 1 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.room,
    // 14pt text on 12+12 still clears the 44pt touch minimum without a hitSlop.
    paddingVertical: space.cosy,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  chipSelected: { backgroundColor: colors.action, borderColor: colors.action },
  chipText: { ...type.label, color: colors.text },
  chipTextSelected: { color: colors.onAccent },

  /** The schedule as one object with two rows, rather than two loose stacks. */
  legGroup: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    overflow: 'hidden',
  },
  legSeam: { height: 1, backgroundColor: colors.border },
  /** 14pt label on 14+14 clears the 44pt touch minimum without a hitSlop. */
  legRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingHorizontal: space.cosy,
    paddingVertical: space.room - 2,
  },
  /** Open reads as the row the chips below belong to, not as a selection. */
  legRowOpen: { backgroundColor: colors.actionSurface },
  legLabel: { ...type.label, color: colors.subtle },
  /** The answer. Right-aligned into whatever the label leaves, and the reason
      the chips can stay closed. */
  legValue: { ...type.label, flex: 1, textAlign: 'right', color: colors.text },
  legPanel: {
    gap: space.snug,
    paddingHorizontal: space.cosy,
    paddingBottom: space.cosy,
    backgroundColor: colors.actionSurface,
  },
  /** The wait, stated once for the pair: the label carries it, the sentence
      spends the rest of the line explaining what it means. */
  turnaroundRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.snug,
    marginTop: -space.tight,
  },
  turnaroundLabel: { ...type.label, color: colors.actionInk },
  turnaroundNote: { ...type.caption, color: colors.subtle, flexShrink: 1 },

  // Each extra is a block, not a cramped row: name and price get a full line,
  // and the control sits under them at a size worth tapping.
  extraBlock: {
    gap: space.snug,
    paddingTop: space.cosy,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  extraHeading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.snug,
  },
  extraName: { ...type.section, color: colors.text, flexShrink: 1 },
  extraCount: { ...type.label, color: colors.primaryDark },
  extraPrice: { ...type.body, color: colors.subtle },
  noticeText: { ...type.body, fontWeight: '600', color: colors.primaryDark },

  // The review: the booking read back to you before the last tap.
  reviewLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
    paddingTop: space.cosy,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reviewLineText: { flex: 1, gap: space.tight },
  reviewName: { ...type.body, fontFamily: type.label.fontFamily, color: colors.text },
  reviewMeta: { ...type.caption, color: colors.subtle },
  reviewAmount: { ...type.body, fontFamily: type.label.fontFamily, color: colors.text },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
  },
  reviewLabel: { ...type.label, color: colors.subtle },
  /** Right-aligned into whatever the label leaves, like the schedule legs. */
  reviewValue: { ...type.body, color: colors.text, flex: 1, textAlign: 'right' },

  // The commitment zone, pinned in the footer.
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.snug,
  },
  priceLabel: { ...type.label, color: colors.subtle },
  priceValue: { ...type.hero, color: colors.text },
  priceValueMuted: { color: colors.subtle },
  priceNote: { ...type.caption, color: colors.subtle },
  commitRow: { flexDirection: 'row', gap: space.snug },
});
