/**
 * The slip a customer gets the moment they book: https://<host>/placed/<id>.
 *
 * Booking used to land straight on the tracking page, which opens on a row of
 * empty steps — an accurate picture of an order nothing has happened to yet,
 * and a cold answer to "did that work?". This page answers that question and
 * nothing else, then hands over to tracking.
 *
 * It is a ticket rather than a card because the shop is about to print one.
 * The paper stock, the punched notches, the dashed tear line and the torn hem
 * are the same material the counter's docket is drawn on — so the first thing
 * a customer holds is the thing the shop will hold too. The code at the foot is
 * this order's own tracking link: the shop can scan it off the screen.
 */
import { useQuery } from '@tanstack/react-query';
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  SlipCode,
  SlipCrown,
  SlipPaper,
  SlipRow,
  SlipStub,
  SlipTear,
  SlipTotal,
} from '@/components/order-slip';
import { ACCENTS, Loading, elevation, formatWhen, space, type } from '@/components/ui-kit';
import { Reveal } from '@/components/reveal';
import { WebShell } from '@/components/web/web-shell';
import { getOrder, type OrderWithDetails } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { actualBill } from '@/lib/domain/actual-bill';
import { docketNumber } from '@/lib/domain/docket';
import { placedNote, placedScene, placedTitle } from '@/lib/domain/order-scene';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { storefrontTheme } from '@/lib/domain/web-theme';

export default function PlacedPage() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { session, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId!),
    enabled: Boolean(orderId && session),
  });

  if (isAuthLoading || isLoading) return <Loading />;
  // The slip is only ever reached straight off a booking. If the order cannot
  // be read, tracking is the page that knows how to ask for a session.
  if (!order) {
    router.replace(`/track/${orderId}` as never);
    return <Loading />;
  }

  return <Slip order={order} />;
}

function Slip({ order }: { order: OrderWithDetails }) {
  const router = useRouter();
  const shopName = order.shop?.name ?? 'Your laundry';
  const theme = storefrontTheme(
    ACCENTS[resolveAccent({ id: order.shop_id, brand_accent: order.shop?.brand_accent ?? null }, ACCENTS.length)]
  );
  const bill = actualBill(order);
  const trackPath = `/track/${order.id}`;
  const trackUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${trackPath}` : trackPath;

  return (
    <>
      <Head>
        <title>{`Booked · ${shopName}`}</title>
      </Head>
      <WebShell>
        <View style={styles.stage}>
          <Reveal>
            <SlipPaper>
              <SlipCrown
                scene={placedScene(order.fulfillment)}
                brand={theme.brand}
                halo={theme.brandSoft}
                title={placedTitle()}
                note={placedNote(order.fulfillment)}
              />

              <SlipTear />

              <SlipStub>
                <SlipRow label="Order" value={docketNumber(order.id)} isCode />
                <SlipRow label="Shop" value={shopName} />
                <SlipRow label="Booked" value={formatWhen(order.created_at)} />
                <SlipRow
                  label={order.fulfillment === 'delivery' ? 'We collect' : 'Drop off'}
                  value={formatWhen(order.pickup_at) || 'The shop will confirm'}
                />
                <SlipTotal label={bill.heading} value={bill.amount} note={bill.note} />
                <SlipCode value={trackUrl} note="Show this at the counter" />
              </SlipStub>
            </SlipPaper>
          </Reveal>

          <Reveal delay={120}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.replace(trackPath as never)}
              style={({ pressed }) => [
                styles.follow,
                { backgroundColor: theme.brand },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.followText, { color: theme.onBrand }]}>Follow my laundry</Text>
            </Pressable>
          </Reveal>
        </View>
      </WebShell>
    </>
  );
}

const styles = StyleSheet.create({
  stage: { padding: space.room, gap: space.section, paddingTop: space.gulf },
  follow: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation.rest,
  },
  followText: { ...type.label, fontSize: 16 },
  pressed: { opacity: 0.85 },
});
