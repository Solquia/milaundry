import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Loading,
  PhoneField,
  Subtle,
  colors,
  formatMoney,
  space,
  type as typeScale,
} from '@/components/ui-kit';
import { getServices, placeOrder, type PlaceOrderOptions } from '@/lib/api';
import {
  PAYMENT_LABELS,
  paidUpfrontLabel,
  paymentSummaryLine,
} from '@/lib/domain/payment-summary';
import { adjustQuantity, quantityCeiling } from '@/lib/domain/order-quantity';
import { nextOpenCategory } from '@/lib/domain/price-accordion';
import { formatQuantity, minimumChargeNotice, priceSubtitle } from '@/lib/domain/price-label';
import { estimateOrderTotal } from '@/lib/domain/pricing';
import {
  CATEGORY_LABELS,
  groupServicesByCategory,
  type ServiceGroup,
} from '@/lib/domain/service-catalog';
import { serviceIcon } from '@/lib/domain/service-icon';
import { intakeLines, intakeSummary, openingQuantity } from '@/lib/domain/service-intake';
import { categoryIcon } from '@/lib/domain/shop-home';
import {
  PAYMENT_METHODS,
  validateWalkIn,
  type Fulfillment,
  type PaymentMethod,
  type WalkInErrors,
} from '@/lib/domain/walk-in-order';
import type { OrderRow, ServiceRow } from '@/lib/types';

type Props = {
  shopId: string;
  submitLabel: string;
  /** 'walk_in' adds POS intake fields (name, phone, fulfillment, payment). */
  mode?: 'customer' | 'walk_in';
  onSuccess: (order: OrderRow) => void;
};

/**
 * One service, offered before it is counted.
 *
 * A row is a *choice* until it is taken, and only then a quantity. The old form
 * gave every service a permanent `− 0 kg +` bar, so a screen of services was a
 * screen of controls sitting at zero and the price above each one looked like
 * the field they belonged to. Here the stepper does not exist until the row has
 * been added, which means a stepper on screen always refers to something that
 * is actually in the order.
 */
function ServiceLine({
  service,
  quantity,
  isFirst,
  onAdd,
  onAdjust,
  onRemove,
}: {
  service: ServiceRow;
  quantity: number;
  isFirst: boolean;
  onAdd: () => void;
  onAdjust: (step: number) => void;
  onRemove: () => void;
}) {
  const isChosen = quantity > 0;
  const max = quantityCeiling(service.unit);
  const step = service.unit === 'per_kg' ? 0.5 : 1;
  const amount = formatQuantity(service.unit, quantity);
  // The shop's own minimum, quoted with the amount it will actually bill —
  // surfaced before the total moves, not after.
  const minimumNotice = minimumChargeNotice(service, quantity);
  // A flat service is billed once however often it is added, so a stepper on it
  // would be a control with nothing to control.
  const isCountable = max > 1;

  return (
    <View style={[styles.line, isFirst && styles.lineFirst, isChosen && styles.lineChosen]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isChosen ? `${service.name}, ${amount} in this order` : `Add ${service.name}`
        }
        accessibilityState={{ selected: isChosen }}
        disabled={isChosen}
        onPress={onAdd}
        style={({ pressed }) => [styles.lineHead, pressed && !isChosen && styles.pressed]}
      >
        <Ionicons
          name={serviceIcon(service.name, service.category) as never}
          size={19}
          color={isChosen ? colors.actionInk : colors.subtle}
        />
        <View style={styles.lineText}>
          <Text style={styles.lineName}>{service.name}</Text>
          <Text style={styles.linePrice}>{priceSubtitle(service)}</Text>
        </View>
        {isChosen ? null : (
          <View style={styles.addMark}>
            <Ionicons name="add" size={20} color={colors.onAccent} />
          </View>
        )}
      </Pressable>

      {isChosen && (
        <View style={styles.stepper}>
          {isCountable ? (
            <>
              <StepperKey
                glyph="remove"
                label={`Less ${service.name}, now ${amount}`}
                disabled={quantity <= step}
                onPress={() => onAdjust(-step)}
              />
              <Text style={styles.stepperValue} accessibilityLiveRegion="polite">
                {amount}
              </Text>
              <StepperKey
                glyph="add"
                label={`More ${service.name}, now ${amount}`}
                disabled={quantity >= max}
                onPress={() => onAdjust(step)}
              />
            </>
          ) : (
            <Text style={styles.stepperValue}>Charged once</Text>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Take ${service.name} off this order`}
            onPress={onRemove}
            hitSlop={space.snug}
            style={({ pressed }) => [styles.removeKey, pressed && styles.pressed]}
          >
            <Text style={styles.removeText}>Remove</Text>
          </Pressable>
        </View>
      )}

      {minimumNotice ? <Text style={styles.notice}>{minimumNotice}</Text> : null}
    </View>
  );
}

/** One half of a stepper. Square, thumb-sized, and never wider than it is tall. */
function StepperKey({
  glyph,
  label,
  disabled,
  onPress,
}: {
  glyph: 'add' | 'remove';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.stepperKey,
        disabled && styles.stepperKeyOff,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Ionicons
        name={glyph}
        size={22}
        color={disabled ? colors.borderStrong : colors.actionInk}
      />
    </Pressable>
  );
}

/**
 * A category, closed until it is wanted.
 *
 * Closed is not hidden: before anything is taken the door quotes what is inside
 * and what it costs, and afterwards it quotes what this order took from it. The
 * same door therefore answers both questions the counter asks — "where do I
 * find it" on the way in, "did I get it" on the way back.
 */
function CategoryDoor({
  group,
  quantities,
  isOpen,
  onToggle,
  onAdd,
  onAdjust,
  onRemove,
}: {
  group: ServiceGroup<ServiceRow>;
  quantities: Record<string, number>;
  isOpen: boolean;
  onToggle: () => void;
  onAdd: (service: ServiceRow) => void;
  onAdjust: (service: ServiceRow, step: number) => void;
  onRemove: (service: ServiceRow) => void;
}) {
  const label = CATEGORY_LABELS[group.category];
  const summary = intakeSummary(group.services, quantities);
  const hasChosen = group.services.some((service) => (quantities[service.id] ?? 0) > 0);

  return (
    <View style={[styles.door, isOpen && styles.doorOpen]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${summary}.`}
        accessibilityHint={isOpen ? 'Closes this category' : 'Opens this category'}
        accessibilityState={{ expanded: isOpen }}
        onPress={onToggle}
        style={({ pressed }) => [styles.doorHead, pressed && styles.pressed]}
      >
        <View style={[styles.doorIcon, hasChosen && styles.doorIconTaken]}>
          <Ionicons
            name={categoryIcon(group.category) as never}
            size={20}
            color={hasChosen ? colors.onAccent : colors.actionInk}
          />
        </View>
        <View style={styles.doorText}>
          <Text style={styles.doorName}>{label}</Text>
          <Text style={[styles.doorSummary, hasChosen && styles.doorSummaryTaken]}>
            {summary}
          </Text>
        </View>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.borderStrong}
        />
      </Pressable>

      {isOpen &&
        group.services.map((service, index) => (
          <ServiceLine
            key={service.id}
            service={service}
            quantity={quantities[service.id] ?? 0}
            isFirst={index === 0}
            onAdd={() => onAdd(service)}
            onAdjust={(step) => onAdjust(service, step)}
            onRemove={() => onRemove(service)}
          />
        ))}
    </View>
  );
}

export function ServiceOrderForm({ shopId, submitLabel, mode = 'customer', onSuccess }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  // Every door shut to begin with. The category is the first decision, and a
  // screen that opens one for you has made it on the counter staff's behalf.
  const [openCategory, setOpenCategory] = useState<string | null>(null);

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

  // A pricing failure used to be swallowed into `null`, which renders exactly
  // like "nothing selected yet" — no estimate, no error, and Save still
  // enabled. Now the failure is a fact the form can show and act on.
  const estimate = useMemo(() => {
    if (!services || selectedItems.length === 0) {
      return { total: null as number | null, failed: false };
    }
    try {
      return { total: estimateOrderTotal(services, selectedItems).total, failed: false };
    } catch {
      return { total: null as number | null, failed: true };
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

  const adjust = (service: ServiceRow, step: number) => {
    setQuantities((prev) => ({
      ...prev,
      [service.id]: adjustQuantity(prev[service.id] ?? 0, step, quantityCeiling(service.unit)),
    }));
  };

  const add = (service: ServiceRow) => {
    setQuantities((prev) => ({ ...prev, [service.id]: openingQuantity(service) }));
  };

  const remove = (service: ServiceRow) => {
    setQuantities((prev) => ({ ...prev, [service.id]: 0 }));
  };

  if (isLoading) return <Loading />;

  const groups = groupServicesByCategory(services ?? []);
  const lines = intakeLines(services ?? [], quantities);
  // With one category there is no choice to make, so making the merchant tap
  // a door before they can reach the only service list would be ceremony.
  const isSoleCategory = groups.length === 1;

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
        <EmptyState message="You have no prices set up yet. Add them under Prices first." />
      )}

      {/* The category comes first, and the screen says so. Every service used to
          arrive with its own stepper, so the counter met a wall of `− 0 kg +`
          bars — each one sitting under a price, where "0 kg" read as a price
          field nobody had filled in. Now a stepper only exists on a row that is
          already in the order. */}
      {groups.length > 0 && (
        <View style={styles.picker}>
          <Text style={styles.pickerTitle}>
            {mode === 'walk_in' ? 'What they brought in' : 'What are you bringing in?'}
          </Text>
          <Text style={styles.pickerHint}>
            {openCategory === null && !isSoleCategory
              ? 'Open a category first, then tap a service to add it.'
              : 'Tap a service to add it, then set the amount.'}
          </Text>
          <View style={styles.doors}>
            {groups.map((group) => (
              <CategoryDoor
                key={group.category}
                group={group}
                quantities={quantities}
                isOpen={isSoleCategory || openCategory === group.category}
                onToggle={() => setOpenCategory(nextOpenCategory(openCategory, group.category))}
                onAdd={add}
                onAdjust={adjust}
                onRemove={remove}
              />
            ))}
          </View>
        </View>
      )}

      {/* What a closed door is allowed to forget, this card remembers. */}
      {lines.length > 0 && estimate.total !== null && (
        <View style={styles.basket}>
          <Text style={styles.basketTitle}>In this order</Text>
          {lines.map((line) => (
            <View key={line.serviceId} style={styles.basketRow}>
              <View style={styles.basketText}>
                <Text style={styles.basketName} numberOfLines={2}>
                  {line.name}
                </Text>
                <Text style={styles.basketQuantity}>{line.quantity}</Text>
              </View>
              <Text style={styles.basketMoney}>{formatMoney(line.subtotal)}</Text>
            </View>
          ))}
          <View style={styles.basketTotal}>
            <Text style={styles.totalLabel}>Estimated total</Text>
            <Text style={styles.totalValue}>{formatMoney(estimate.total)}</Text>
          </View>
          <Text style={styles.basketNote}>
            {mode === 'walk_in'
              ? 'You can set the final price after weighing.'
              : 'Final price is confirmed by the shop after weighing.'}
          </Text>
        </View>
      )}

      {estimate.failed && (
        <ErrorText>
          One of these prices cannot be read. Open Prices and check it before saving this order.
        </ErrorText>
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
          <Subtle>
            {paymentSummaryLine({
              paymentMethod,
              isPaid,
              fulfillment,
              total: estimate.total ?? 0,
            })}
          </Subtle>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>
      {mode === 'walk_in' && (
        <Button
          title={paidUpfrontLabel(isPaid)}
          variant={isPaid ? 'primary' : 'outline'}
          onPress={() => setIsPaid((paid) => !paid)}
        />
      )}
      <Button
        title={mutation.isPending ? 'Submitting…' : submitLabel}
        onPress={handleSubmit}
        disabled={selectedItems.length === 0 || estimate.failed || mutation.isPending}
      />
      {selectedItems.length === 0 && (
        // A disabled button with no stated reason is a dead end.
        <Subtle>
          {mode === 'walk_in'
            ? 'Add what the customer brought in above, then save.'
            : 'Add what you are bringing in above, then book.'}
        </Subtle>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  /**
   * The service picker: a heading, a line of instruction, and the doors.
   *
   * The screen's own stack spaces every block equally, which left this heading
   * as close to the customer's details above it as to the doors it introduces.
   * The extra step opens a gap wide enough to read as a new decision.
   */
  picker: { gap: space.snug, marginTop: space.snug },
  pickerTitle: { ...typeScale.section, color: colors.text },
  // Set above the doors rather than inside each one: it describes the whole
  // control, and repeating it per category would be six copies of one sentence.
  pickerHint: { ...typeScale.body, color: colors.subtle, marginBottom: space.tight },
  doors: { gap: space.cosy },

  /** One category. Ruled inside, like the owner's price list next door. */
  door: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  doorOpen: { borderColor: colors.actionMuted },
  doorHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.room,
  },
  doorIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionSurface,
  },
  // A category this order has taken from wears the filled mark, so the doors
  // read as a checklist on the way back down the screen.
  doorIconTaken: { backgroundColor: colors.action },
  doorText: { flex: 1, gap: 2 },
  doorName: { ...typeScale.label, fontSize: 16, color: colors.text },
  doorSummary: { ...typeScale.caption, color: colors.subtle },
  doorSummaryTaken: { color: colors.actionInk, fontWeight: '600' },

  /** One service inside an open category. */
  line: { borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: space.snug },
  // The first row meets the header, which already has a rule of its own.
  lineFirst: { borderTopWidth: 0 },
  lineChosen: { backgroundColor: colors.actionSurface },
  lineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy,
  },
  lineText: { flex: 1, gap: 2 },
  lineName: { ...typeScale.body, fontWeight: '600', color: colors.text },
  linePrice: { ...typeScale.caption, color: colors.subtle },
  /** The tap target that turns a listed service into a counted one. */
  addMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.action,
  },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingHorizontal: space.room,
    paddingBottom: space.snug,
  },
  stepperKey: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.actionMuted,
    backgroundColor: colors.card,
  },
  stepperKeyOff: { borderColor: colors.border, backgroundColor: colors.sunken },
  // Takes the middle so the two keys stay pinned to a fixed distance apart —
  // a thumb learns where they are and stops aiming.
  stepperValue: {
    ...typeScale.value,
    flex: 1,
    textAlign: 'center',
    color: colors.text,
  },
  removeKey: { paddingHorizontal: space.snug, paddingVertical: space.cosy },
  removeText: { ...typeScale.label, color: colors.dangerInk },

  notice: {
    ...typeScale.caption,
    color: colors.moneyOut,
    paddingHorizontal: space.room,
    paddingBottom: space.snug,
  },

  /**
   * The order as it stands. This is what buys the doors the right to close:
   * the merchant can fold a category away because nothing folds away with it.
   */
  basket: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.cosy,
  },
  basketTitle: { ...typeScale.label, color: colors.subtle, letterSpacing: 0.3 },
  basketRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.cosy },
  basketText: { flex: 1, gap: 2 },
  basketName: { ...typeScale.body, fontWeight: '600', color: colors.text },
  basketQuantity: { ...typeScale.caption, color: colors.subtle },
  basketMoney: { ...typeScale.body, fontWeight: '600', color: colors.text },
  basketTotal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: space.cosy,
  },
  totalLabel: { ...typeScale.label, color: colors.subtle },
  totalValue: { ...typeScale.value, color: colors.text },
  basketNote: { ...typeScale.caption, color: colors.subtle },

  pressed: { opacity: 0.7 },
});
