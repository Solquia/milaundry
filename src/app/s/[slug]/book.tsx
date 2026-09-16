/**
 * Booking from a shop's web page: https://<host>/s/<slug>/book.
 *
 * Three steps, one column. What to wash, when and where, and who is asking.
 * The last step is where a guest becomes a customer: a name and a number
 * make an account and a session, and the order is placed in the same tap.
 * Someone already signed in skips that and books as themselves.
 */
import { useQuery } from '@tanstack/react-query';
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENTS, ErrorText, Loading, colors, formatMoney, space, type } from '@/components/ui-kit';
import { BrandButton } from '@/components/brand-button';
import { Odometer } from '@/components/odometer';
import { CartList } from '@/components/web/cart-list';
import { GuestForm } from '@/components/web/guest-form';
import { DEFAULT_SCHEDULE, SchedulePicker, type ScheduleValue } from '@/components/web/schedule-picker';
import { PageBand, WebShell, useWebLayout } from '@/components/web/web-shell';
import { getMyAddresses, getStorefront, placeOrder, registerWithShopBySlug } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { friendlyBookingError, isConnectionError } from '@/lib/domain/booking-error';
import { validateBookingSchedule, type BookingScheduleErrors } from '@/lib/domain/booking-schedule';
import { defaultAddress } from '@/lib/domain/customer-book';
import type { Slot } from '@/lib/domain/booking-slot';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { previousStep } from '@/lib/domain/step-rail';
import { cartCount, cartItems, cartLines, cartTotal, startingCart, type Cart } from '@/lib/domain/web-cart';
import { storefrontTheme } from '@/lib/domain/web-theme';
import type { Storefront } from '@/lib/types';

type Step = 'items' | 'schedule' | 'contact';

/**
 * The three questions, in the order they are asked. The band names whichever
 * one is current; this is what Back counts backwards through.
 */
const STEPS = [
  { key: 'items', label: 'Items' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'contact', label: 'Details' },
] as const satisfies readonly { key: Step; label: string }[];
const STEP_TITLES: Record<Step, string> = {
  items: 'What are we washing?',
  schedule: 'When and where?',
  contact: 'Who is this for?',
};
const DAY_MS = 24 * 60 * 60 * 1000;

/** A concrete Date from "N days from today at H o'clock". */
function slotDate(slot: Slot): Date {
  const date = new Date(Date.now() + slot.dayOffset * DAY_MS);
  date.setHours(slot.hour, 0, 0, 0);
  return date;
}

export default function BookPage() {
  const { slug, service } = useLocalSearchParams<{ slug: string; service?: string | string[] }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ['storefront', slug],
    queryFn: () => getStorefront(slug!),
    enabled: Boolean(slug),
  });

  if (isLoading) return <Loading />;
  if (error || !data) {
    return (
      <WebShell>
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>
            {error ? 'We could not load this page' : 'This laundry is not online'}
          </Text>
        </View>
      </WebShell>
    );
  }
  return <BookingFlow storefront={data} slug={slug!} preselected={service} />;
}

interface BookingFlowProps {
  storefront: Storefront;
  slug: string;
  /** The service a price row was tapped on, if the customer came from one. */
  preselected?: string | string[];
}

function BookingFlow({ storefront, slug, preselected }: BookingFlowProps) {
  const { shop, services } = storefront;
  const theme = storefrontTheme(ACCENTS[resolveAccent(shop, ACCENTS.length)]);
  const router = useRouter();
  const layout = useWebLayout();
  const { session, profile, signOut } = useAuth();

  const [step, setStep] = useState<Step>('items');
  const [cart, setCart] = useState<Cart>(() => startingCart(preselected, services));
  const [schedule, setSchedule] = useState<ScheduleValue>(DEFAULT_SCHEDULE);

  // The customer's own book. A guest has none until they sign in on the last
  // step, which is exactly when the field stops mattering.
  const addressBook = useQuery({
    queryKey: ['my-addresses'],
    queryFn: getMyAddresses,
    enabled: Boolean(session),
  });
  const saved = addressBook.data ?? [];
  /**
   * Derived, not seeded: the default fills the field until the customer types
   * or picks, and an effect that wrote it in would race whatever they typed.
   */
  const scheduleWithAddress: ScheduleValue = {
    ...schedule,
    address: schedule.address || defaultAddress(saved)?.address || '',
  };
  const [fieldErrors, setFieldErrors] = useState<BookingScheduleErrors>({});
  const [error, setError] = useState('');
  const [isPlacing, setIsPlacing] = useState(false);
  /** Set the moment an order may have reached the shop; never cleared by a lost reply. */
  const [mayHaveBooked, setMayHaveBooked] = useState(false);
  const placingRef = useRef(false);

  const total = cartTotal(cartLines(cart, services));
  const count = cartCount(cart);

  const validatedSchedule = () =>
    validateBookingSchedule(
      {
        fulfillment: scheduleWithAddress.fulfillment,
        deliveryAddress: scheduleWithAddress.address,
        pickupAt: slotDate(scheduleWithAddress.pickup),
        deliverBy: slotDate(scheduleWithAddress.deliver),
      },
      new Date()
    );

  const goToContact = () => {
    const result = validatedSchedule();
    if (!result.ok) {
      setFieldErrors(result.errors);
      return;
    }
    setFieldErrors({});
    setStep('contact');
  };

  /** Runs with a session in hand: connect to the shop, place the order, go and track it. */
  const placeBooking = async () => {
    // Two taps, or the form's sign-in and the footer button landing together,
    // must not place two orders.
    if (placingRef.current) return;
    const result = validatedSchedule();
    if (!result.ok) {
      setFieldErrors(result.errors);
      setStep('schedule');
      return;
    }
    setError('');
    placingRef.current = true;
    setIsPlacing(true);
    try {
      const shopId = await registerWithShopBySlug(slug);
      const order = await placeOrder(
        shopId,
        cartItems(cart).map((item) => ({ service_id: item.serviceId, quantity: item.quantity })),
        // Always an online booking, even when the person tapping Book is the
        // owner: this is the shop's public page, not its counter.
        {
          ...result.value,
          notes: scheduleWithAddress.notes.trim(),
          orderType: 'online' as const,
          // Booked with the method this customer always uses, so the pay screen
          // opens on their own answer instead of on the shop's default.
          ...(profile?.preferred_payment_method
            ? { paymentMethod: profile.preferred_payment_method }
            : {}),
        }
      );
      // The slip first, then tracking. A booking that lands straight on a row of
      // empty steps is an accurate picture of an order nothing has happened to
      // yet, and a cold answer to "did that work?".
      router.replace(`/placed/${order.id}` as never);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      // A lost reply is not a failed order: place_order may have run. Say so
      // and point at the orders list rather than inviting a second booking.
      if (isConnectionError(message)) setMayHaveBooked(true);
      setError(friendlyBookingError(message));
      placingRef.current = false;
      setIsPlacing(false);
    }
  };

  const handleSignOut = () => {
    signOut().catch((err: unknown) => {
      setError(friendlyBookingError(err instanceof Error ? err.message : ''));
    });
  };

  /** Where Back goes. Null on the first step, which is why it is not drawn. */
  const back = previousStep(STEPS, step);

  const footer = (
    <View style={styles.footer}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {count === 0 ? 'Nothing added yet' : `${count} ${count === 1 ? 'line' : 'lines'} · estimate`}
        </Text>
        {/* The one number the whole step is producing, so it moves with the
            ruler that produces it rather than blinking to a new figure. */}
        <Odometer
          value={formatMoney(total)}
          style={{ ...styles.totalValue, color: theme.brandInk }}
          label={`Estimate ${formatMoney(total)}`}
        />
      </View>
      <ErrorText>{error}</ErrorText>
      {mayHaveBooked ? (
        <Pressable accessibilityRole="link" onPress={() => router.push(`/s/${slug}/orders` as never)}>
          <Text style={[styles.link, { color: theme.brandInk }]}>
            Your booking may have gone through. Check your orders before trying again ›
          </Text>
        </Pressable>
      ) : null}
      <View style={styles.buttons}>
        {back ? (
          <BrandButton
            title="Back"
            onPress={() => setStep(back)}
            fill={theme.brandSoft}
            ink={theme.brandInk}
            flex={1}
          />
        ) : null}
        {step === 'items' ? (
          <BrandButton
            title="Continue"
            onPress={() => setStep('schedule')}
            disabled={count === 0}
            fill={theme.brand}
            ink={theme.onBrand}
            flex={2}
          />
        ) : null}
        {step === 'schedule' ? (
          <BrandButton title="Continue" onPress={goToContact} fill={theme.brand} ink={theme.onBrand} flex={2} />
        ) : null}
        {step === 'contact' && session ? (
          <BrandButton
            title={isPlacing ? 'Placing…' : 'Place order'}
            onPress={() => void placeBooking()}
            disabled={isPlacing}
            fill={theme.brand}
            ink={theme.onBrand}
            flex={2}
          />
        ) : null}
      </View>
    </View>
  );

  return (
    <>
      <Head>
        <title>{`Book with ${shop.name}`}</title>
      </Head>
      <WebShell
        footer={footer}
        hero={
          <PageBand
            backLabel={shop.name}
            onBack={() => router.push(`/s/${slug}` as never)}
            title={STEP_TITLES[step]}
            theme={theme}
          />
        }
      >
        <View style={[styles.body, { padding: layout.gutter }]}>
          {step === 'items' ? (
            <>
              <Text style={styles.hint}>
                Guess the weight; the shop weighs it and confirms the price before you pay.
              </Text>
              <CartList services={services} cart={cart} onChange={setCart} theme={theme} />
            </>
          ) : null}

          {step === 'schedule' ? (
            <SchedulePicker
              value={scheduleWithAddress}
              onChange={setSchedule}
              errors={fieldErrors}
              theme={theme}
              addresses={saved}
            />
          ) : null}

          {step === 'contact' ? (
            <View style={styles.card}>
              {session ? (
                <>
                  <Text style={styles.cardTitle}>Booking as {profile?.full_name || 'you'}</Text>
                  {profile?.phone ? (
                    <Text style={styles.hint}>The shop will reach you on {profile.phone}.</Text>
                  ) : null}
                  <Pressable accessibilityRole="button" onPress={handleSignOut}>
                    <Text style={[styles.link, { color: theme.brandInk }]}>Not you? Use another number</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.cardTitle}>Your name and number</Text>
                  <GuestForm
                    submitLabel="Place order"
                    busyLabel="Placing…"
                    onSignedIn={placeBooking}
                    theme={theme}
                  />
                </>
              )}
            </View>
          ) : null}
        </View>
      </WebShell>
    </>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.cosy },
  hint: { ...type.caption, color: colors.subtle },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.cosy,
  },
  cardTitle: { ...type.section, color: colors.text },
  link: { ...type.label },
  footer: { gap: space.snug },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { ...type.caption, color: colors.subtle },
  totalValue: { ...type.value, color: colors.text },
  buttons: { flexDirection: 'row', gap: space.snug },
  notice: { padding: space.gulf, marginTop: space.gulf * 2 },
  noticeTitle: { ...type.title, color: colors.text, textAlign: 'center' },
});
