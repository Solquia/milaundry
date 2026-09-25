/**
 * The till.
 *
 * Two steps, the way a phone POS rings a sale: tap what came in, then take the
 * details and the money. The menu is a grid of priced tiles and the running
 * total never leaves the bottom of the screen; the second step lays the ticket
 * out on paper with every line still editable, then asks who it is for and how
 * they paid. The old screen asked the name first and buried the total under
 * an accordion — the counter typed before it counted.
 *
 * It is dressed as the flow it is. A customer booking on the shop's own web
 * page walks through named, numbered questions under a band in the shop's
 * colour, with the estimate pinned under their thumb and a Back beside every
 * Continue. The counter was asking the same questions with none of that: an
 * unnamed second screen reached by a text link, and a button that carried the
 * price. Same band, same rail, same footer, same paper slip at the end — so
 * whoever is holding the phone, the shop takes an order one way.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandButton } from '@/components/brand-button';
import { CheckoutForm } from '@/components/checkout-form';
import { CounterBand } from '@/components/counter-band';
import { Odometer } from '@/components/odometer';
import {
  SlipCode,
  SlipCrown,
  SlipPaper,
  SlipRow,
  SlipStub,
  SlipTear,
  SlipTotal,
} from '@/components/order-slip';
import { Reveal } from '@/components/reveal';
import type { QuantityTone } from '@/components/quantity-picker';
import { ScaleSheet } from '@/components/scale-sheet';
import { ALL_CATEGORIES, CategoryStrip, ServiceMenu } from '@/components/service-menu';
import { TicketSlip } from '@/components/ticket-slip';
import {
  ACCENTS,
  EmptyState,
  ErrorState,
  ErrorText,
  Loading,
  Screen,
  Subtle,
  colors,
  formatMoney,
  formatWhen,
  space,
  type,
} from '@/components/ui-kit';
import { getOrder, getServices, placeOrder, type PlaceOrderOptions } from '@/lib/api';
import { actualBill } from '@/lib/domain/actual-bill';
import { docketNumber } from '@/lib/domain/docket';
import { shopRoleBadge } from '@/lib/domain/merchant-access';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { orderContact } from '@/lib/domain/order-contact';
import { adjustQuantity, quantityCeiling } from '@/lib/domain/order-quantity';
import { placedScene } from '@/lib/domain/order-scene';
import { paymentSummaryLine } from '@/lib/domain/payment-summary';
import { tapTile, ticketCount, ticketCountLabel, untapTile } from '@/lib/domain/pos-ticket';
import { estimateOrderTotal } from '@/lib/domain/pricing';
import { buildOrderQr } from '@/lib/domain/qr';
import { groupServicesByCategory } from '@/lib/domain/service-catalog';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { previousStep } from '@/lib/domain/step-rail';
import {
  TILL_STEPS,
  savedScanNote,
  savedSlipNote,
  savedSlipTitle,
  tillCta,
  tillEstimateLabel,
  tillStepTitle,
  type TillStep,
} from '@/lib/domain/till-flow';
import {
  validateWalkIn,
  type WalkInErrors,
  type WalkInInput,
} from '@/lib/domain/walk-in-order';
import { storefrontTheme, type StorefrontTheme } from '@/lib/domain/web-theme';
import type { OrderRow, ServiceRow, Shop } from '@/lib/types';
import { useActiveShop } from '@/lib/use-active-shop';
import { useHaptic } from '@/lib/use-app-settings';
import { usePrinter } from '@/lib/use-printer';
import { confirmAction } from '@/lib/confirm';

const EMPTY_INTAKE: WalkInInput = {
  customerName: '',
  customerPhone: '',
  fulfillment: 'pickup',
  deliveryAddress: '',
  paymentMethod: 'cash',
  isPaid: false,
};

/** The counter wears the same colour the shop's own web page does. */
function shopTheme(shop: Shop): StorefrontTheme {
  return storefrontTheme(ACCENTS[resolveAccent(shop, ACCENTS.length)]);
}

/**
 * The frame both steps share: the band up top, scrolling work under it, a
 * pinned decision below. Unlike `Screen`, it lifts the footer over the
 * keyboard, because the checkout step types a name directly above the button
 * that saves it.
 */
function TillShell({
  band,
  children,
  footer,
  scroll = true,
}: {
  band: React.ReactNode;
  children: React.ReactNode;
  footer: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView style={styles.shell} edges={['left', 'right']}>
      {band}
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
  const { shop, shopRole, isLoading, error: shopError } = useActiveShop();

  const [step, setStep] = useState<TillStep>('items');
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
    // The saved slip only holds the order row; the receipt wants its lines too.
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
  // from Continue, an unguarded Clear is a mis-tap waiting to happen.
  const confirmClear = () => {
    haptic('warning');
    confirmAction(
      {
        title: 'Clear the ticket?',
        message: `${ticketCountLabel(count)} will come off.`,
        confirmLabel: 'Clear',
        dismissLabel: 'Keep',
      },
      () => setQuantities({})
    );
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
    setStep('items');
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

  const theme = shopTheme(shop);
  // The ruler, the chips and a chosen tile wear the same colour as the band;
  // the app's blue would be a second brand inside one flow.
  const tone: QuantityTone = { brand: theme.brand, soft: theme.brandSoft, ink: theme.brandInk };

  if (lastOrder) {
    const contact = orderContact(lastOrder);
    const bill = actualBill(lastOrder);
    return (
      <SafeAreaView style={styles.shell} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.savedContent}>
          <Reveal>
            {/* The same slip a customer's own booking prints, filled in by the
                counter: the shop is about to hand this order over, and both
                sides of the counter should be looking at one object. */}
            <SlipPaper>
              <SlipCrown
                scene={placedScene(lastOrder.fulfillment)}
                brand={theme.brand}
                halo={theme.brandSoft}
                title={savedSlipTitle()}
                note={savedSlipNote(lastOrder.fulfillment)}
              />

              <SlipTear />

              <SlipStub>
                <SlipRow label="Order" value={docketNumber(lastOrder.id)} isCode />
                <SlipRow label="Customer" value={contact.name} />
                <SlipRow label="Taken" value={formatWhen(lastOrder.created_at)} />
                <SlipTotal
                  label={bill.heading}
                  value={bill.amount}
                  note={paymentSummaryLine({
                    paymentMethod: lastOrder.payment_method,
                    isPaid: lastOrder.payment_status === 'paid',
                    fulfillment: lastOrder.fulfillment,
                    total: lastOrder.final_total ?? lastOrder.estimated_total,
                  })}
                />
                {/* The ticket's own claim code. Held up at the counter it puts
                    the order in the customer's phone, which is the difference
                    between a walk-in they can follow and one they cannot. */}
                <SlipCode
                  value={buildOrderQr(lastOrder.id, lastOrder.claim_token)}
                  note={savedScanNote()}
                />
              </SlipStub>
            </SlipPaper>
          </Reveal>

          <Reveal delay={120}>
            <View style={styles.savedActions}>
              <View style={styles.buttons}>
                <BrandButton
                  title="Next customer"
                  onPress={startNext}
                  fill={theme.brand}
                  ink={theme.onBrand}
                  flex={2}
                />
                {printer.saved ? (
                  <BrandButton
                    title={printer.state.kind === 'printing' ? 'Printing…' : 'Print'}
                    onPress={() => printLastOrder(lastOrder.id)}
                    disabled={printer.state.kind === 'printing'}
                    fill={theme.brandSoft}
                    ink={theme.brandInk}
                    flex={1}
                  />
                ) : null}
              </View>
              {printer.state.kind === 'error' ? <ErrorText>{printer.state.message}</ErrorText> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open this order"
                onPress={() => {
                  const orderId = lastOrder.id;
                  startNext();
                  router.push(`/(merchant)/order/${orderId}`);
                }}
                style={({ pressed }) => [styles.openRow, pressed && styles.pressed]}
              >
                <Text style={[styles.openText, { color: theme.brandInk }]}>Open this order ›</Text>
              </Pressable>
            </View>
          </Reveal>
        </ScrollView>
      </SafeAreaView>
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
      tone={tone}
    />
  );

  const band = (
    <CounterBand
      theme={theme}
      shopName={shop.name}
      roleBadge={shopRoleBadge(shopRole)}
      title={tillStepTitle(step)}
      steps={TILL_STEPS}
      current={step}
      onGo={setStep}
      onSettings={() => router.push('/(merchant)/settings')}
    />
  );

  /** Where Back goes. Null on the first step, which is why it is not drawn. */
  const back = previousStep(TILL_STEPS, step);

  /**
   * The running total, pinned. The same row the booking page carries: what is
   * on the ticket on the left, the one figure the step is producing on the
   * right, moving on the ruler that produces it rather than blinking to it.
   */
  const totalRow = (
    <View style={styles.totalRow}>
      <Text style={styles.totalLabel}>{tillEstimateLabel(count)}</Text>
      {/* An em dash is not a number and has no wheels to turn, so an
          unpriceable ticket stays plain text. */}
      {estimate.total === null ? (
        <Text style={[styles.totalValue, styles.totalMuted]}>—</Text>
      ) : (
        <Odometer
          value={formatMoney(estimate.total)}
          style={{ ...styles.totalValue, color: theme.brandInk }}
          label={`Estimate ${formatMoney(estimate.total)}`}
        />
      )}
    </View>
  );

  if (step === 'checkout') {
    return (
      <TillShell
        band={band}
        footer={
          <>
            {/* The total stays pinned on this step too: the slip above scrolls
                away under the keyboard, and the figure is what is being saved. */}
            {totalRow}
            <View style={styles.buttons}>
              {back ? (
                <BrandButton
                  title="Add more"
                  onPress={() => setStep(back)}
                  fill={theme.brandSoft}
                  ink={theme.brandInk}
                  flex={1}
                />
              ) : null}
              <BrandButton
                title={tillCta('checkout', mutation.isPending)}
                onPress={handleSave}
                disabled={count === 0 || estimate.failed || mutation.isPending}
                fill={theme.brand}
                ink={theme.onBrand}
                flex={2}
              />
            </View>
          </>
        }
      >
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
          tone={tone}
        />
        <ErrorText>{saveError}</ErrorText>

        {scaleSheet}
      </TillShell>
    );
  }

  return (
    <TillShell
      band={band}
      scroll={false}
      footer={
        <>
          {totalRow}
          <View style={styles.buttons}>
            {/* Clear only exists once there is something to lose, and it is the
                one control here that is not the shop's colour. */}
            {count > 0 ? (
              <BrandButton
                title="Clear"
                onPress={confirmClear}
                fill={colors.sunken}
                ink={colors.dangerInk}
                flex={1}
              />
            ) : null}
            <BrandButton
              title={tillCta('items', false)}
              onPress={goToCheckout}
              disabled={count === 0 || estimate.failed}
              fill={theme.brand}
              ink={theme.onBrand}
              flex={2}
            />
          </View>
          {estimate.failed ? (
            <ErrorText>One of these prices cannot be read. Check it under Prices.</ErrorText>
          ) : null}
        </>
      }
    >
      <View style={styles.stripWrap}>
        <CategoryStrip groups={groups} active={category} onChange={setCategory} tone={tone} />
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ServiceMenu
          groups={groups}
          active={category}
          quantities={quantities}
          onTap={handleTile}
          onLess={handleLess}
          tone={tone}
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
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
  },
  totalLabel: { ...type.caption, color: colors.subtle },
  totalValue: { ...type.value, color: colors.text },
  totalMuted: { color: colors.subtle },
  buttons: { flexDirection: 'row', gap: space.snug },

  /**
   * Clear of the raised tab button. The saved slip draws its own frame rather
   * than `Screen`'s, so the room the tab bar needs is this file's to keep.
   */
  savedContent: {
    padding: space.room,
    paddingTop: space.section,
    paddingBottom: space.gulf * 2,
    gap: space.section,
  },
  savedActions: { gap: space.cosy },
  openRow: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  openText: { ...type.label },

  pressed: { opacity: 0.7 },
});
