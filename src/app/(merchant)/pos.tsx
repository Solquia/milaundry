/**
 * The till.
 *
 * Two steps, the way a phone POS rings a sale: tap what came in, then take the
 * details and the money. The menu is a grid of priced tiles and the running
 * total never leaves the bottom of the screen; the second step lays the ticket
 * out on paper with every line still editable, then asks who it is for and how
 * they paid. The old screen asked the name first and buried the total under
 * an accordion — the counter typed before it counted.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckoutForm } from '@/components/checkout-form';
import { ScaleSheet } from '@/components/scale-sheet';
import { ALL_CATEGORIES, CategoryStrip, ServiceMenu } from '@/components/service-menu';
import { TicketSlip } from '@/components/ticket-slip';
import {
  Button,
  EmptyState,
  ErrorState,
  ErrorText,
  Loading,
  Screen,
  Subtle,
  colors,
  formatMoney,
  mono,
  space,
  type,
  CROWN,
} from '@/components/ui-kit';
import { getOrder, getServices, placeOrder, type PlaceOrderOptions } from '@/lib/api';
import { docketNumber } from '@/lib/domain/docket';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { orderContact } from '@/lib/domain/order-contact';
import { adjustQuantity, quantityCeiling } from '@/lib/domain/order-quantity';
import { orderTags } from '@/lib/domain/order-tags';
import {
  chargeLabel,
  tapTile,
  ticketCount,
  ticketCountLabel,
  untapTile,
} from '@/lib/domain/pos-ticket';
import { estimateOrderTotal } from '@/lib/domain/pricing';
import { groupServicesByCategory } from '@/lib/domain/service-catalog';
import {
  validateWalkIn,
  type WalkInErrors,
  type WalkInInput,
} from '@/lib/domain/walk-in-order';
import type { OrderRow, ServiceRow } from '@/lib/types';
import { useActiveShop } from '@/lib/use-active-shop';
import { useHaptic } from '@/lib/use-app-settings';
import { usePrinter } from '@/lib/use-printer';

type Step = 'ring' | 'checkout';

const EMPTY_INTAKE: WalkInInput = {
  customerName: '',
  customerPhone: '',
  fulfillment: 'pickup',
  deliveryAddress: '',
  paymentMethod: 'cash',
  isPaid: false,
};

/**
 * The frame both steps share: scrolling work above, a pinned decision below.
 * Unlike `Screen`, it lifts the footer over the keyboard, because the checkout
 * step types a name directly above the button that saves it.
 */
function TillShell({
  children,
  footer,
  scroll = true,
}: {
  children: React.ReactNode;
  footer: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={styles.shell} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={styles.shell}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
        <View style={styles.footer}>{footer}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function Pos() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const haptic = useHaptic();
  const { shop, isLoading, error: shopError } = useActiveShop();

  const [step, setStep] = useState<Step>('ring');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [weighing, setWeighing] = useState<ServiceRow | null>(null);
  const [intake, setIntake] = useState<WalkInInput>(EMPTY_INTAKE);
  const [fieldErrors, setFieldErrors] = useState<WalkInErrors>({});
  const [saveError, setSaveError] = useState('');
  const [lastOrder, setLastOrder] = useState<OrderRow | null>(null);

  const shopId = shop?.id;
  const { data: services, isLoading: isLoadingServices } = useQuery({
    queryKey: ['services', shopId],
    queryFn: () => getServices(shopId!),
    enabled: Boolean(shopId),
  });

  const selectedItems = useMemo(
    () =>
      Object.entries(quantities)
        .filter(([, qty]) => qty > 0)
        .map(([serviceId, quantity]) => ({ serviceId, quantity })),
    [quantities]
  );
  const count = ticketCount(quantities);

  // A pricing failure is a fact the screen shows, never a silent `null` that
  // looks like "nothing chosen yet" with Save still lit.
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

  const printer = usePrinter();

  const printLastOrder = async (orderId: string) => {
    // The saved card only holds the order row; the receipt wants its lines too.
    let full;
    try {
      full = await getOrder(orderId);
    } catch (err) {
      printer.reportError(friendlyMerchantError('open-order', err instanceof Error ? err.message : ''));
      return;
    }
    await printer.printReceipt(full, {
      name: shop?.name ?? 'MiLaundry',
      address: shop?.address,
      phone: shop?.phone,
    });
  };

  const mutation = useMutation({
    mutationFn: (options: PlaceOrderOptions) =>
      placeOrder(
        shopId!,
        selectedItems.map((item) => ({ service_id: item.serviceId, quantity: item.quantity })),
        options
      ),
    onSuccess: async (order) => {
      haptic('success');
      await queryClient.invalidateQueries({ queryKey: ['shop-orders', shopId] });
      setLastOrder(order);
    },
    onError: (err: Error) => {
      haptic('error');
      setSaveError(friendlyMerchantError('save-order', err.message));
    },
  });

  const setQuantity = (service: ServiceRow, quantity: number) => {
    setQuantities((prev) => ({ ...prev, [service.id]: quantity }));
  };

  const handleTile = (service: ServiceRow) => {
    const tap = tapTile(service, quantities[service.id] ?? 0);
    if (tap.kind === 'weigh') {
      haptic('tap');
      setWeighing(service);
      return;
    }
    haptic('select');
    setQuantity(service, tap.quantity);
  };

  const handleLess = (service: ServiceRow) => {
    haptic('select');
    setQuantity(service, untapTile(service, quantities[service.id] ?? 0));
  };

  // One tap wipes the whole ticket, so it asks first. Sitting a thumb's width
  // above the Charge button, an unguarded Clear is a mis-tap waiting to happen.
  const confirmClear = () => {
    haptic('warning');
    Alert.alert('Clear the ticket?', `${ticketCountLabel(count)} will come off.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setQuantities({}) },
    ]);
  };

  const handleAdjust = (service: ServiceRow, delta: number) => {
    haptic('select');
    setQuantity(
      service,
      adjustQuantity(quantities[service.id] ?? 0, delta, quantityCeiling(service.unit))
    );
  };

  const handleRemove = (service: ServiceRow) => {
    haptic('select');
    setQuantity(service, 0);
    setWeighing(null);
  };

  const handleWeighed = (kg: number) => {
    if (!weighing) return;
    haptic('select');
    setQuantity(weighing, kg);
    setWeighing(null);
  };

  const goToCheckout = () => {
    haptic('commit');
    setSaveError('');
    setStep('checkout');
  };

  const handleSave = () => {
    setSaveError('');
    setFieldErrors({});
    const result = validateWalkIn(intake);
    if (!result.ok) {
      haptic('warning');
      setFieldErrors(result.errors);
      return;
    }
    haptic('commit');
    mutation.mutate({
      fulfillment: result.value.fulfillment,
      deliveryAddress: result.value.deliveryAddress,
      customerName: result.value.customerName,
      customerPhone: result.value.customerPhone,
      paymentMethod: result.value.paymentMethod,
      isPaid: result.value.isPaid,
    });
  };

  const startNext = () => {
    setLastOrder(null);
    setQuantities({});
    setIntake(EMPTY_INTAKE);
    setFieldErrors({});
    setSaveError('');
    setCategory(ALL_CATEGORIES);
    setStep('ring');
  };

  if (isLoading || (shopId && isLoadingServices)) return <Loading />;
  // Distinguished states: a failed lookup is not the same fact as "you have no
  // shop", and telling an owner mid-shift that their shop is gone is worse
  // than telling them the connection dropped.
  if (shopError) {
    return (
      <Screen>
        <ErrorState message={friendlyMerchantError('load-shop', shopError.message)} />
      </Screen>
    );
  }
  if (!shop) {
    return (
      <EmptyState message="Your account is not connected to a shop yet. Ask your administrator to add you." />
    );
  }

  if (lastOrder) {
    return (
      <Screen center>
        <View style={styles.saved}>
          <View style={styles.savedMark}>
            <Ionicons name="checkmark" size={34} color={colors.onAccent} />
          </View>
          <Text style={styles.savedTitle}>Order saved</Text>
          <Text style={styles.savedDocket}>NO. {docketNumber(lastOrder.id)}</Text>
          <View style={styles.savedCard}>
            <Text style={styles.savedName}>{orderContact(lastOrder).name}</Text>
            <Subtle>{orderTags(lastOrder).join(' · ')}</Subtle>
            <Text style={styles.savedTotal}>
              {formatMoney(lastOrder.final_total ?? lastOrder.estimated_total)}
            </Text>
          </View>
          {printer.saved ? (
            <Button
              title={printer.state.kind === 'printing' ? 'Printing…' : 'Print receipt'}
              variant="outline"
              disabled={printer.state.kind === 'printing'}
              onPress={() => printLastOrder(lastOrder.id)}
            />
          ) : null}
          {printer.state.kind === 'error' ? <ErrorText>{printer.state.message}</ErrorText> : null}
          <Button title="Next customer" onPress={startNext} />
          <Button
            title="Open this order"
            variant="outline"
            onPress={() => {
              const orderId = lastOrder.id;
              startNext();
              router.push(`/(merchant)/order/${orderId}`);
            }}
          />
        </View>
      </Screen>
    );
  }

  const groups = groupServicesByCategory(services ?? []);

  if (groups.length === 0) {
    return (
      <Screen center>
        <EmptyState
          message="You have no prices set up yet. Add them under Prices first."
          actionLabel="Set up prices"
          onAction={() => router.push('/(merchant)/services')}
        />
      </Screen>
    );
  }

  const scaleSheet = (
    <ScaleSheet
      service={weighing}
      currentKg={weighing ? (quantities[weighing.id] ?? 0) : 0}
      onConfirm={handleWeighed}
      onRemove={() => weighing && handleRemove(weighing)}
      onClose={() => setWeighing(null)}
    />
  );

  if (step === 'checkout') {
    return (
      <TillShell
        footer={
          <>
            {/* The total stays pinned on this step too: the slip above scrolls
                away under the keyboard, and the figure is what is being saved. */}
            <View style={styles.footerRow}>
              <Text style={styles.footerCount}>{ticketCountLabel(count)}</Text>
              <Text style={styles.footerTotal}>
                {estimate.total === null ? '—' : formatMoney(estimate.total)}
              </Text>
            </View>
            <Button
              title={mutation.isPending ? 'Saving…' : 'Save order'}
              onPress={handleSave}
              disabled={count === 0 || estimate.failed || mutation.isPending}
            />
          </>
        }
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to the menu"
          onPress={() => setStep('ring')}
          hitSlop={space.snug}
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" size={20} color={colors.actionInk} />
          <Text style={styles.backText}>Add more items</Text>
        </Pressable>

        <TicketSlip
          services={services ?? []}
          quantities={quantities}
          total={estimate.total}
          onAdjust={handleAdjust}
          onWeigh={setWeighing}
          onRemove={handleRemove}
        />
        {estimate.failed ? (
          <ErrorText>
            One of these prices cannot be read. Open Prices and check it before saving.
          </ErrorText>
        ) : null}
        {count === 0 ? (
          <Subtle>The ticket is empty. Go back and tap what the customer brought in.</Subtle>
        ) : null}

        <CheckoutForm
          value={intake}
          errors={fieldErrors}
          total={estimate.total}
          onChange={(patch) => setIntake((prev) => ({ ...prev, ...patch }))}
        />
        <ErrorText>{saveError}</ErrorText>

        {scaleSheet}
      </TillShell>
    );
  }

  return (
    <TillShell
      scroll={false}
      footer={
        <>
          <View style={styles.footerRow}>
            <Text style={styles.footerCount}>{ticketCountLabel(count)}</Text>
            {count > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear the ticket"
                onPress={confirmClear}
                hitSlop={space.cosy}
                style={({ pressed }) => [styles.footerClearKey, pressed && styles.pressed]}
              >
                <Text style={styles.footerClear}>Clear</Text>
              </Pressable>
            ) : null}
          </View>
          <Button
            title={chargeLabel(count, estimate.total)}
            onPress={goToCheckout}
            disabled={count === 0 || estimate.failed}
          />
          {estimate.failed ? (
            <ErrorText>One of these prices cannot be read. Check it under Prices.</ErrorText>
          ) : null}
        </>
      }
    >
      <View style={styles.stripWrap}>
        <CategoryStrip groups={groups} active={category} onChange={setCategory} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ServiceMenu
          groups={groups}
          active={category}
          quantities={quantities}
          onTap={handleTile}
          onLess={handleLess}
        />
      </ScrollView>

      {scaleSheet}
    </TillShell>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.room, paddingBottom: space.section, gap: space.cosy },
  stripWrap: { paddingTop: space.cosy, paddingBottom: space.tight },
  footer: {
    paddingHorizontal: space.room,
    paddingTop: space.cosy,
    paddingBottom: space.cosy,
    gap: space.snug,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.cosy,
  },
  footerCount: { ...type.label, color: colors.subtle },
  footerTotal: { ...type.value, fontFamily: mono, color: colors.text },
  footerClearKey: { minHeight: 32, justifyContent: 'center', paddingHorizontal: space.tight },
  footerClear: { ...type.label, color: colors.dangerInk },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    alignSelf: 'flex-start',
  },
  backText: { ...type.label, color: colors.actionInk },

  saved: { alignItems: 'stretch', gap: space.cosy },
  savedMark: {
    alignSelf: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.moneyIn,
  },
  savedTitle: { ...type.title, textAlign: 'center', color: colors.text },
  savedDocket: {
    fontFamily: mono,
    fontSize: 13,
    letterSpacing: 1,
    textAlign: 'center',
    color: colors.subtle,
    marginBottom: space.snug,
  },
  savedCard: {
    backgroundColor: colors.card,
    ...CROWN,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.tight,
    alignItems: 'center',
    marginBottom: space.snug,
  },
  savedName: { ...type.section, color: colors.text },
  savedTotal: { ...type.hero, color: colors.text, marginTop: space.tight },

  pressed: { opacity: 0.7 },
});
