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
import { CartList } from '@/components/web/cart-list';
import { GuestForm } from '@/components/web/guest-form';
import { DEFAULT_SCHEDULE, SchedulePicker, type ScheduleValue } from '@/components/web/schedule-picker';
import { WebShell } from '@/components/web/web-shell';
import { getStorefront, placeOrder, registerWithShopBySlug } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { friendlyBookingError, isConnectionError } from '@/lib/domain/booking-error';
import { validateBookingSchedule, type BookingScheduleErrors } from '@/lib/domain/booking-schedule';
import type { Slot } from '@/lib/domain/booking-slot';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { EMPTY_CART, cartCount, cartItems, cartLines, cartTotal, type Cart } from '@/lib/domain/web-cart';
import { storefrontTheme } from '@/lib/domain/web-theme';
import type { Storefront } from '@/lib/types';

type Step = 'items' | 'schedule' | 'contact';

const STEPS: Step[] = ['items', 'schedule', 'contact'];
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
  const { slug } = useLocalSearchParams<{ slug: string }>();
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
  return <BookingFlow storefront={data} slug={slug!} />;
}

function BookingFlow({ storefront, slug }: { storefront: Storefront; slug: string }) {
  const { shop, services } = storefront;
  const theme = storefrontTheme(ACCENTS[resolveAccent(shop, ACCENTS.length)]);
  const router = useRouter();
  const { session, profile, signOut } = useAuth();

  const [step, setStep] = useState<Step>('items');
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [schedule, setSchedule] = useState<ScheduleValue>(DEFAULT_SCHEDULE);
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
        fulfillment: schedule.fulfillment,
        deliveryAddress: schedule.address,
        pickupAt: slotDate(schedule.pickup),
        deliverBy: slotDate(schedule.deliver),
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
        { ...result.value, notes: schedule.notes.trim() }
      );
      router.replace(`/track/${order.id}` as never);
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

  const footer = (
    <View style={styles.footer}>
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {count === 0 ? 'Nothing added yet' : `${count} ${count === 1 ? 'line' : 'lines'} · estimate`}
        </Text>
        <Text style={styles.totalValue}>{formatMoney(total)}</Text>
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
        {step !== 'items' ? (
          <FooterButton
            title="Back"
            onPress={() => setStep(step === 'contact' ? 'schedule' : 'items')}
            fill={theme.brandSoft}
            ink={theme.brandInk}
            flex={1}
          />
        ) : null}
        {step === 'items' ? (
          <FooterButton
            title="Next: schedule"
            onPress={() => setStep('schedule')}
            disabled={count === 0}
            fill={theme.brand}
            ink={theme.onBrand}
            flex={2}
          />
        ) : null}
        {step === 'schedule' ? (
          <FooterButton title="Next: your details" onPress={goToContact} fill={theme.brand} ink={theme.onBrand} flex={2} />
        ) : null}
        {step === 'contact' && session ? (
          <FooterButton
            title={isPlacing ? 'Booking…' : 'Book now'}
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
      <WebShell footer={footer}>
        <View style={[styles.band, { backgroundColor: theme.brand }]}>
          <Pressable accessibilityRole="link" onPress={() => router.push(`/s/${slug}` as never)}>
            <Text style={[styles.bandBack, { color: theme.onBrand }]}>‹ {shop.name}</Text>
          </Pressable>
          <Text style={[styles.bandTitle, { color: theme.onBrand }]}>{STEP_TITLES[step]}</Text>
          <View style={styles.progress}>
            {STEPS.map((name, index) => (
              <View
                key={name}
                style={[
                  styles.progressBar,
                  { backgroundColor: theme.onBrand, opacity: index <= STEPS.indexOf(step) ? 1 : 0.35 },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.body}>
          {step === 'items' ? (
            <>
              <Text style={styles.hint}>
                Guess the weight; the shop weighs it and confirms the price before you pay.
              </Text>
              <CartList services={services} cart={cart} onChange={setCart} theme={theme} />
            </>
          ) : null}

          {step === 'schedule' ? (
            <SchedulePicker value={schedule} onChange={setSchedule} errors={fieldErrors} theme={theme} />
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
                  <GuestForm submitLabel="Book now" busyLabel="Booking…" onSignedIn={placeBooking} theme={theme} />
                </>
              )}
            </View>
          ) : null}
        </View>
      </WebShell>
    </>
  );
}

interface FooterButtonProps {
  title: string;
  onPress: () => void;
  fill: string;
  ink: string;
  flex: number;
  disabled?: boolean;
}

function FooterButton({ title, onPress, fill, ink, flex, disabled }: FooterButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { flex, backgroundColor: fill, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.buttonText, { color: ink }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  band: { padding: space.room, gap: space.snug },
  bandBack: { ...type.caption, fontWeight: '600', opacity: 0.9 },
  bandTitle: { ...type.title },
  progress: { flexDirection: 'row', gap: space.snug, marginTop: space.tight },
  progressBar: { flex: 1, height: 3, borderRadius: 2 },
  body: { padding: space.room, gap: space.cosy },
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
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.cosy,
  },
  buttonText: { ...type.label, fontSize: 16 },
  notice: { padding: space.gulf, marginTop: space.gulf * 2 },
  noticeTitle: { ...type.title, color: colors.text, textAlign: 'center' },
});
