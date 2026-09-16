/**
 * One order, followed from a browser: https://<host>/track/<order-id>.
 *
 * Reached from the booking page and, in phase 3, from a receipt's code. It
 * needs the session the booking made; a visitor who lands here without one
 * gives their name and number and gets it back. The order is re-read every
 * half minute while the tab is open, so the shop's updates arrive on their
 * own. A guest who wants the app is offered a password here, once, because
 * this is the page they will have open when they decide they want more.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TORN_EDGE_HEIGHT, TicketPerforation, TornEdge } from '@/components/torn-edge';
import { ACCENTS, Loading, colors, elevation, formatMoney, formatWhen, space, type } from '@/components/ui-kit';
import { GuestForm } from '@/components/web/guest-form';
import { PasswordCard } from '@/components/web/password-card';
import { TrackingSteps } from '@/components/web/tracking-steps';
import { WebShell } from '@/components/web/web-shell';
import { getOrder, type OrderWithDetails } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { actualBill } from '@/lib/domain/actual-bill';
import { docketNumber } from '@/lib/domain/docket';
import { trackingHeadline } from '@/lib/domain/order-tracking';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { availableRails, railsNotice } from '@/lib/domain/shop-payment';
import { storefrontTheme } from '@/lib/domain/web-theme';
import { isPasswordPending } from '@/lib/web-guest-state';

/** How often the page asks the shop what has changed. */
const POLL_MS = 30_000;

export default function TrackPage() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { session, isLoading: isAuthLoading } = useAuth();
  const queryClient = useQueryClient();
  // Offered on every visit until a password exists: the link is this
  // account's only key until then. Remembered by the browser that made the
  // guest account, so an account that already has a password is never asked
  // to overwrite it.
  const isNewAccount = isPasswordPending();

  const { data: order, isLoading, error } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId!),
    enabled: Boolean(orderId && session),
    refetchInterval: POLL_MS,
  });

  if (isAuthLoading) return <Loading />;

  if (!session) {
    const neutral = storefrontTheme(ACCENTS[0]);
    return (
      <WebShell>
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>Show my order</Text>
          <Text style={styles.hint}>Enter the name and number you booked with.</Text>
          <View style={styles.card}>
            <GuestForm
              submitLabel="Show my order"
              busyLabel="One moment…"
              onSignedIn={() => queryClient.invalidateQueries({ queryKey: ['order', orderId] })}
              theme={neutral}
            />
          </View>
        </View>
      </WebShell>
    );
  }

  if (isLoading) return <Loading />;
  if (error || !order) {
    return (
      <WebShell>
        <View style={styles.body}>
          <Text style={styles.sectionTitle}>We can&apos;t find this order for your number</Text>
          <Text style={styles.hint}>
            It may belong to a different number. Check the link, or ask the shop.
          </Text>
        </View>
      </WebShell>
    );
  }

  return <OrderBody order={order} isNewAccount={isNewAccount} />;
}

function OrderBody({ order, isNewAccount }: { order: OrderWithDetails; isNewAccount: boolean }) {
  const router = useRouter();
  const [isPasswordDone, setIsPasswordDone] = useState(false);
  // The torn edges are cut to the paper's real width, so they wait for it.
  const [width, setWidth] = useState(0);
  const shopName = order.shop?.name ?? 'Your laundry';
  const theme = storefrontTheme(
    ACCENTS[resolveAccent({ id: order.shop_id, brand_accent: order.shop?.brand_accent ?? null }, ACCENTS.length)]
  );
  const bill = actualBill(order);
  const rails = order.shop ? availableRails(order.shop, shopName) : [];
  const slug = order.shop?.slug;

  return (
    <>
      <Head>
        <title>{`${shopName} · order ${docketNumber(order.id)}`}</title>
      </Head>
      <WebShell>
        <View style={styles.stage}>
          {/* One ticket, not a stack of cards.
              Everything about this page is one docket: the shop's header, the
              path the laundry walks, what it costs, where it is going. Six
              separate white panels said that as six unrelated facts; the paper
              says it as one thing the shop issued, which is what it is. The
              slip at /placed is the short version of this same ticket. */}
          <View
            style={styles.ticket}
            onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
          >
            <View style={[styles.head, { backgroundColor: theme.brand }]}>
              <TornEdge width={width} color={colors.bg} edge="top" />
              {slug ? (
                <Pressable accessibilityRole="link" onPress={() => router.push(`/s/${slug}` as never)}>
                  <Text style={[styles.headBack, { color: theme.onBrand }]}>‹ {shopName}</Text>
                </Pressable>
              ) : (
                <Text style={[styles.headBack, { color: theme.onBrand }]}>{shopName}</Text>
              )}
              <Text style={[styles.headTitle, { color: theme.onBrand }]}>
                {trackingHeadline(order.status, order.fulfillment)}
              </Text>
              <Text style={[styles.headMeta, { color: theme.onBrand }]}>
                Order {docketNumber(order.id)} · {formatWhen(order.created_at)}
              </Text>
            </View>

            <TicketPerforation color={colors.bg} ruleColor={colors.paperRule} />

            <View style={styles.stub}>
              <TrackingSteps status={order.status} fulfillment={order.fulfillment} theme={theme} />

              <Section title="Your order">
                {order.order_items.map((item) => (
                  <View key={item.id} style={styles.line}>
                    <Text style={styles.lineName}>
                      {item.service_name} × {item.quantity}
                      {item.unit === 'per_kg' ? ' kg' : ''}
                    </Text>
                    <Text style={styles.linePrice}>{formatMoney(item.subtotal)}</Text>
                  </View>
                ))}
                <View style={styles.totalLine}>
                  <Text style={styles.totalLabel}>{bill.heading}</Text>
                  <Text style={styles.totalValue}>{bill.amount}</Text>
                </View>
                {bill.difference ? <Text style={styles.hint}>{bill.difference}</Text> : null}
                <Text style={styles.hint}>{bill.note}</Text>
              </Section>

              {order.fulfillment === 'delivery' ? (
                <Section title="Pickup &amp; delivery">
                  <Detail label="Address" value={order.delivery_address} />
                  <Detail label="We collect" value={formatWhen(order.pickup_at)} />
                  <Detail label="Back with you by" value={formatWhen(order.deliver_by)} />
                </Section>
              ) : null}

              {bill.isPayable ? (
                <Section title="How to pay">
                  <Text style={styles.hint}>{railsNotice(order.shop ?? {}, shopName)}</Text>
                  {rails.map((rail) => (
                    <Detail
                      key={rail.method}
                      label={rail.label}
                      value={`${rail.accountNumber} · ${rail.accountName}`}
                    />
                  ))}
                  {rails.length > 0 ? (
                    <Text style={styles.hint}>
                      After sending, tell the shop your reference number. Cash on{' '}
                      {order.fulfillment === 'delivery' ? 'delivery' : 'pickup'} is always fine too.
                    </Text>
                  ) : null}
                </Section>
              ) : null}
            </View>

            <TornEdge width={width} color={colors.bg} edge="bottom" />
          </View>

          {isNewAccount && !isPasswordDone ? (
            <PasswordCard phone={order.customer_phone} onDone={() => setIsPasswordDone(true)} theme={theme} />
          ) : null}
        </View>
      </WebShell>
    </>
  );
}

/**
 * A titled block on the ticket.
 *
 * Divided by a dashed rule rather than by a card of its own: on paper the
 * sections of a docket are separated by a printed line, and boxing each one
 * would put a card inside a card.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.detail}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * The brand block ends in a curve, the way the shopfront hero does, so an
   * order's page reads as part of the same shop rather than as the app's.
   */
  /** The page's field, with the ticket standing on it. */
  stage: { padding: space.room, paddingTop: space.section, gap: space.room },
  /**
   * The docket itself. `overflow: 'hidden'` is what cuts the punched notches
   * and both torn edges: each is drawn as a colour biting into the paper.
   */
  ticket: {
    backgroundColor: colors.paper,
    borderRadius: 20,
    overflow: 'hidden',
    ...elevation.lift,
  },
  /**
   * The shop's own colour at the head of the slip, the way a printed docket
   * carries a letterhead. The teeth along the top are cut in the brand rather
   * than in the page, so the tear runs through the colour.
   */
  head: {
    paddingHorizontal: space.room,
    paddingTop: TORN_EDGE_HEIGHT + space.cosy,
    paddingBottom: space.room,
    gap: space.snug,
  },
  headBack: { ...type.caption, fontWeight: '600', opacity: 0.9 },
  headTitle: { ...type.title },
  headMeta: { ...type.caption, opacity: 0.9 },
  stub: {
    paddingHorizontal: space.room,
    paddingTop: space.room,
    paddingBottom: TORN_EDGE_HEIGHT + space.room,
    gap: space.room,
  },
  /** Ruled off rather than boxed: on paper a section is a printed line. */
  section: {
    gap: space.snug,
    borderTopWidth: 1,
    borderTopColor: colors.paperRule,
    borderStyle: 'dashed',
    paddingTop: space.room,
  },
  body: { padding: space.room, gap: space.cosy },
  sectionTitle: { ...type.section, color: colors.text },
  hint: { ...type.caption, color: colors.subtle },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.snug,
  },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.cosy },
  lineName: { ...type.body, color: colors.text, flex: 1 },
  linePrice: { ...type.body, color: colors.text, fontVariant: ['tabular-nums'] },
  totalLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.room,
    borderTopWidth: 1,
    borderTopColor: colors.paperRule,
    borderStyle: 'dashed',
    paddingTop: space.cosy,
    marginTop: space.tight,
  },
  totalLabel: { ...type.label, color: colors.text },
  totalValue: { ...type.value, color: colors.text },
  detail: { gap: 2 },
  detailLabel: { ...type.caption, color: colors.subtle },
  detailValue: { ...type.body, color: colors.text },
});
