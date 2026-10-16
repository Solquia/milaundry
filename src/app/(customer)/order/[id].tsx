import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GLASS_GROUND, glassPane } from '@/components/glass';
import { LaundryTracker } from '@/components/laundry-tracker';
import { PaySheet } from '@/components/pay-sheet';
import { ShopLogo } from '@/components/shop-logo';
import { TicketPerforation } from '@/components/torn-edge';
import {
  ACCENTS,
  Button,
  Card,
  ErrorText,
  Field,
  Loading,
  Screen,
  RADII,
  colors,
  formatMoney,
  formatWhen,
  space,
  type,
} from '@/components/ui-kit';
import {
  addReview,
  getOrder,
  getOrderHistory,
  orderPhotoUrl,
  updateOrderStatus,
} from '@/lib/api';
import { actualBill, type BillStage } from '@/lib/domain/actual-bill';
import { appliedReward } from '@/lib/domain/rewards';
import { bookingPaymentStage } from '@/lib/domain/booking-status';
import { docketNumber, stampLabel } from '@/lib/domain/docket';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { PAYMENT_LABELS } from '@/lib/domain/payment-summary';
import { canBookAgain, rebookHref } from '@/lib/domain/rebook';
import { weighEvidence } from '@/lib/domain/weigh-evidence';
import { lineLabel } from '@/lib/domain/price-label';
import { supabase } from '@/lib/supabase';
import { confirmAction } from '@/lib/confirm';
import { canHideOrder, hideOrderPrompt } from '@/lib/domain/hidden-orders';
import { useHiddenOrders } from '@/lib/use-hidden-orders';
import { fontFor } from '@/lib/domain/design-scale';

/**
 * The mark at the head of the docket.
 *
 * Big enough that a laundry's own artwork is legible as artwork — most of
 * these are badges with the shop's name lettered inside them, and below about
 * 80 the lettering is a smudge. Held at that floor: the tracker above now owns
 * the first screenful, and the receipt is the second thing read, not the first.
 */
const LOGO_SIZE = 48;

export default function CustomerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const { hiddenIds, hide, unhide } = useHiddenOrders();

  // The torn edges are drawn in real pixels, so the docket has to be measured;
  // an SVG sized in percentages paints a fixed viewport in react-native-svg.

  // Review prompt state (shown once the order is completed).
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hasReviewed, setHasReviewed] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id!),
    enabled: Boolean(id),
  });

  const { data: history } = useQuery({
    queryKey: ['order-history', id],
    queryFn: () => getOrderHistory(id!),
    enabled: Boolean(id),
  });

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['order', id] });
          queryClient.invalidateQueries({ queryKey: ['order-history', id] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  // The proof behind a price that moved: the merchant's photo of the load on
  // the scale. The path is on the order; the bucket is private, so viewing it
  // means minting a short-lived signed link. `staleTime` sits under the link's
  // one-hour TTL so a screen left open refetches before the link dies.
  const evidence = order ? weighEvidence(order) : null;
  const { data: evidenceUrl } = useQuery({
    queryKey: ['order-photo', evidence?.photoPath],
    queryFn: () => orderPhotoUrl(evidence!.photoPath),
    enabled: Boolean(evidence),
    staleTime: 45 * 60 * 1000,
  });

  const reviewMutation = useMutation({
    mutationFn: () =>
      addReview({
        shopId: order!.shop_id,
        orderId: order!.id,
        rating,
        comment,
      }),
    onSuccess: () => setHasReviewed(true),
    onError: (err: Error) => setError(err.message),
  });

  // A mutation, not a bare async handler: `isPending` stops a double-tap from
  // firing a second cancel while the first is still in flight.
  const cancelMutation = useMutation({
    mutationFn: () => updateOrderStatus(id!, 'cancelled'),
    onMutate: () => setError(''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
    },
    onError: (err: Error) => setError(err.message || 'Cancel failed'),
  });

  const handleCancel = () => {
    if (!id || cancelMutation.isPending) return;
    cancelMutation.mutate();
  };

  if (isLoading || !order) return <Loading />;

  const isHidden = hiddenIds.has(order.id);
  // Clearing lands the customer on home, where the order is now gone — the
  // proof that the tap did what it said.
  const handleRemoveFromHome = () =>
    confirmAction(hideOrderPrompt(1), () => {
      hide([order.id]);
      router.replace('/(customer)/orders' as never);
    });

  const stage = bookingPaymentStage(order);
  const bill = actualBill(order);
  const reward = appliedReward(order);
  const shopName = order.shop?.name ?? 'Order';

  // The laundry's own tone — chosen by the shop, or its stable hash when it has
  // never chosen. Same resolution the directory and the shopfront use, so one
  // laundry is one colour everywhere the customer meets it.
  const accent =
    ACCENTS[
      resolveAccent(
        { id: order.shop?.id ?? order.shop_id, brand_accent: order.shop?.brand_accent ?? null },
        ACCENTS.length
      )
    ];
  const money = BILL_TONES[bill.stage];
  const stamp = stampLabel(bill.stage);
  const againHref = canBookAgain(order) ? rebookHref(order) : null;

  return (
    <Screen>
      {/* The answer to the question this screen is opened for — where is my
          laundry — comes first and owns the top of the screen. It also carries
          the history: every stop on its rail can be tapped for when it
          happened, so there is no separate log card further down. */}
      <LaundryTracker order={order} history={history ?? []} />

      {/* The estimate-vs-actual banners that used to sit here said the same
          thing as the bill card below, one screenful earlier. The bill names
          its own figure now, so the price is stated once. */}

      {/*
        The docket.

        This card was already a receipt — an itemised list with a total under it
        — so it is the one thing on the screen that gets to be paper. The
        tracker is a live readout and the schedule is a plan; dressing those as
        paper too would be a costume rather than an object.

        Everything here is a real convention of the slip a shop staples to the
        bag: torn edges, warm stock, monospaced figures that column up because a
        thermal printer has one width per glyph, leader dots carrying the eye
        across to the price, a double rule above the total, and a short number
        the customer can actually say out loud at the counter.
      */}
      <View style={styles.docket}>

        {/*
          The letterhead.

          The shop used to be said twice in the first two hundred pixels: a
          small initials disc with the name beside it, and then, immediately
          under it, a coloured bar with the same name printed in it again.
          Neither was the shop's actual mark — the logo the merchant uploaded
          reached the directory and the shopfront but never the one screen
          about that shop's work.

          So the two are now one thing, and it is the head of the ticket, which
          is where a printed docket carries a letterhead anyway: the mark large
          and centred, the name under it, the state under that. The shop's tone
          is still what the region is painted in — two orders from two
          laundries are still two different-coloured tickets in the same wallet
          — but as the pale field rather than the deep one, because a logo is
          artwork with its own colours and a saturated slab behind it fights
          every one of them.
        */}
        <View style={[styles.letterhead, { backgroundColor: accent.surface }]}>
          <ShopLogo
            name={shopName}
            logoUrl={order.shop?.logo_url ?? null}
            size={LOGO_SIZE}
            accent={accent}
            shape="plate"
          />
          <View style={styles.letterheadWords}>
            <Text style={styles.letterheadName} numberOfLines={2}>
              {shopName}
            </Text>
            <Text style={[styles.letterheadMeta, { color: accent.ink }]} numberOfLines={1}>
              Order {docketNumber(order.id)}
            </Text>
          </View>
        </View>

        <View style={styles.ticketBody}>
          {/* The docket's own small print, on the line a till prints it: the
              number on the left to say out loud at the counter, when it was
              taken on the right. */}
          <View style={styles.docketMetaRow}>
            <Text style={styles.docketMeta}>NO. {docketNumber(order.id)}</Text>
            <Text style={styles.docketMeta}>{formatWhen(order.created_at)}</Text>
          </View>
          <DottedRule />

          {order.order_items.map((item) => (
            <View key={item.id} style={styles.itemLine}>
              <Text style={styles.itemName}>
                {lineLabel(item.service_name, item.unit, item.quantity)}
              </Text>
              {/* Leader dots, the way a printed bill carries the eye across a
                  gap it would otherwise lose its place in. Empty and
                  decorative, so nothing is announced. */}
              <View style={styles.leader} />
              <Text style={styles.itemPrice}>{formatMoney(item.subtotal)}</Text>
            </View>
          ))}
        </View>

        {/* The tear line. Above it is what the shop is doing; below it is what
            the customer owes — the seam a real ticket is actually torn on. */}
        <TicketPerforation color={GLASS_GROUND} ruleColor="rgba(60, 60, 67, 0.12)" />

        {/* A settled stub takes the takings tint across its whole area — the
            one time colour is allowed to own a region here rather than a mark,
            because "this is finished and paid" is worth seeing before reading. */}
        <View style={[styles.stub, money.field && { backgroundColor: money.field }]}>
          <View style={styles.stubRow}>
            {/* The mark, struck at an angle the way a hand-held stamp lands.
                Absent entirely on an estimate: nobody has stood behind that
                number yet, so there is nothing to stamp. */}
            {stamp ? (
              <View
                style={[styles.stamp, { borderColor: money.ink }]}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <Text style={[styles.stampText, { color: money.ink }]}>{stamp}</Text>
              </View>
            ) : null}

            {/* The figure takes the colour of what it *is*: an estimate stays
                ink, a weighed load turns amber, a settled one green. */}
            <View style={styles.billLine}>
              <Text style={styles.billHeading}>{bill.heading}</Text>
              <Text style={[styles.billAmount, { color: money.ink }]}>{bill.amount}</Text>
              {bill.difference ? (
                <Text style={styles.billDifference}>{bill.difference}</Text>
              ) : null}
              {reward ? (
                <Text style={styles.billReward}>
                  {`Reward used: ${reward.label} · ${formatMoney(reward.discount)} off`}
                </Text>
              ) : null}
            </View>
          </View>

          {/* The evidence, stapled to the bill it justifies. A price that moved
              sits directly above the photograph of the scale that moved it. */}
          {evidence && evidenceUrl ? (
            <View style={styles.evidence}>
              <View style={styles.evidenceFrame}>
                <Image
                  source={{ uri: evidenceUrl }}
                  style={styles.evidencePhoto}
                  contentFit="cover"
                  accessibilityLabel={evidence.caption}
                />
              </View>
              <Text style={styles.evidenceCaption}>{evidence.caption}</Text>
            </View>
          ) : null}

          <DottedRule />
          {/* Prose stays in the app's own face. Monospace is the material of a
              figure, not of a sentence — a paragraph set in it only reads more
              slowly. */}
          <Text style={styles.docketNote}>{bill.note}</Text>
        </View>

      </View>

      {/* Pickup & delivery schedule for delivery bookings.

          The address used to sit here as a bare "Malibu" under the heading —
          a word with no job, which the customer has to guess is an address and
          not a branch or a note. Every fact in this card now says what it is
          before it says what it holds, and the card heading supplies the
          "pickup & delivery" part so no row has to repeat it. */}
      {order.fulfillment === 'delivery' && (
        <Card>
          <Text style={styles.cardTitle}>Pickup &amp; Delivery</Text>
          <DetailRow label="Address" value={order.delivery_address} />
          <DetailRow label="We collect" value={formatWhen(order.pickup_at)} />
          <DetailRow label="Back with you by" value={formatWhen(order.deliver_by)} />
        </Card>
      )}

      {/* The paying surface: which rails this shop actually takes, where the
          money goes, and the customer's receipt afterwards. Renders nothing
          while the total is still an estimate, and after the bill settles. */}
      <PaySheet order={order} />
      {/* The bill above already went green on its own field, so this card no
          longer repeats the signal in a second green sentence — two adjacent
          greens is how an accent stops meaning anything. It carries the facts
          the bill cannot: which method, and when. */}
      {stage === 'paid' && (
        <Card>
          <DetailRow label="Paid with" value={PAYMENT_LABELS[order.payment_method]} />
          <DetailRow label="Paid" value={formatWhen(order.paid_at)} />
        </Card>
      )}

      {/* Review prompt once the laundry journey is done. */}
      {order.status === 'completed' && !hasReviewed && (
        <Card>
          <Text style={styles.cardTitle}>How was {order.shop?.name ?? 'the shop'}?</Text>
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                accessibilityRole="button"
                accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
                onPress={() => setRating(star)}
                hitSlop={6}
              >
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={28}
                  color={star <= rating ? '#FF9500' : '#C7C7CC'}
                />
              </Pressable>
            ))}
          </View>
          <Field
            label="Tell other customers about it (optional)"
            value={comment}
            onChangeText={setComment}
            placeholder="Clothes came back fresh and on time!"
            multiline
          />
          <Button
            title={reviewMutation.isPending ? 'Posting…' : 'Post review'}
            disabled={rating === 0 || reviewMutation.isPending}
            onPress={() => reviewMutation.mutate()}
          />
        </Card>
      )}
      {order.status === 'completed' && hasReviewed && (
        <Card>
          <Text style={[styles.cardTitle, { color: colors.success }]}>
            Thanks for your review!
          </Text>
        </Card>
      )}

      <ErrorText>{error}</ErrorText>

      {/*
        The way out, and the way back in.

        This screen used to end on a saturated red slab. Nothing else on it —
        not the shop, not the status, not the bill — carried anything like that
        weight, so the loudest object on a screen opened to ask "where are my
        clothes" was the one action almost nobody wants. And there was no
        forward exit at all: a customer who had read everything could only
        leave through a tab that goes somewhere unrelated.

        So the bottom is one action region with a hierarchy rather than one
        button. Done leads, and leads *back to the laundry this order came
        from* — the place where the next load is booked, which is the actual
        next thing a satisfied customer does. Cancelling is still offered, and
        still unmistakably red, but it is offered rather than urged: red ink on
        the field instead of a field of red.
      */}
      <View style={styles.actions}>
        {/* A finished load's likeliest next step is the same load again. It
            opens a filled review — same shop, service, weight, address and
            instructions — where every answer can still be changed. */}
        {againHref && (
          <Button
            title="Book again"
            accessibilityLabel={`Book again at ${order.shop?.name ?? 'this shop'}, same as this order`}
            onPress={() => router.push(againHref as never)}
          />
        )}
        <Button
          title="Done"
          variant={againHref ? 'outline' : undefined}
          accessibilityLabel={`Done. Back to ${order.shop?.name ?? 'the shop'}`}
          // Replace, not push: "Done" closes this order. Pushing would leave a
          // shop → order → shop stack where Back walks into the screen the
          // customer just finished with.
          onPress={() => router.replace(`/(customer)/shop/${order.shop_id}` as never)}
        />
        {order.status === 'pending' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel order"
            accessibilityState={{ disabled: cancelMutation.isPending, busy: cancelMutation.isPending }}
            disabled={cancelMutation.isPending}
            onPress={handleCancel}
            style={({ pressed }) => [
              styles.cancel,
              (pressed || cancelMutation.isPending) && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.cancelText}>
              {cancelMutation.isPending ? 'Cancelling…' : 'Cancel order'}
            </Text>
          </Pressable>
        )}
        {canHideOrder(order.status) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isHidden ? 'Show this order on home again' : 'Remove this order from home'}
            onPress={isHidden ? () => unhide([order.id]) : handleRemoveFromHome}
            style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.6 }]}
          >
            <Text style={isHidden ? styles.restoreText : styles.cancelText}>
              {isHidden ? 'Show on home again' : 'Remove from home'}
            </Text>
          </Pressable>
        )}
      </View>
    </Screen>
  );
}

/**
 * The dotted rule a printed slip uses instead of a solid one.
 *
 * `borderStyle: 'dashed'` on a 1px border is the only dotted line React Native
 * draws natively, and it renders as a real dash pattern on both platforms. It
 * is a divider with no content, so it stays out of the accessibility tree.
 */
function DottedRule() {
  return <View accessibilityElementsHidden style={styles.dottedRule} />;
}

/**
 * What the bill's figure is made of, by stage.
 *
 * The colour is the state. `actual-bill` already decides which of the two
 * prices is on screen; this is the same decision said in ink, so the moment the
 * number stops being a guess is a moment the customer can see rather than one
 * they have to re-read the heading to catch.
 *
 * The hues are the app's existing money roles, not new swatches: `moneyOut` is
 * what the merchant side paints receivables, `moneyIn` what it paints takings.
 * An estimate gets no field at all — a tint would give a provisional number the
 * weight of a demand.
 */
const BILL_TONES: Record<BillStage, { ink: string; field: string | null }> = {
  estimated: { ink: colors.text, field: null },
  weighed: { ink: colors.moneyOut, field: null },
  settled: { ink: colors.moneyIn, field: colors.takingsSurface },
};

/**
 * One labelled fact.
 *
 * Renders nothing at all when there is no value — including when `formatWhen`
 * hands back an empty string for an unreadable timestamp. A row that prints
 * "We collect —" tells the customer less than no row does, and the old code
 * printed the literal words "Invalid Date" in exactly that spot.
 */
function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;

  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  /**
   * The bill, set as a Wallet pass: one white card with the laundry's colour
   * across its head, the punched notches of a pass between what the shop is
   * doing and what is owed, and figures in tabular numerals so the prices
   * column up the way a till's do.
   */
  docket: {
    ...glassPane,
    borderRadius: RADII.card - 4,
    paddingBottom: space.room,
    overflow: 'hidden',
  },
  /** The head of the pass, and the one region the laundry's own colour owns. */
  letterhead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingVertical: space.room,
  },
  letterheadWords: { flex: 1, minWidth: 0, gap: 2 },
  letterheadName: { ...type.body, fontSize: 17, lineHeight: 22, ...fontFor(600), color: colors.text },
  letterheadMeta: { ...type.caption, ...fontFor(600), letterSpacing: 0.3 },
  ticketBody: { paddingHorizontal: space.room, paddingVertical: space.cosy, gap: space.snug + 2 },
  /** Below the notches: what the customer owes, and why. */
  stub: { paddingHorizontal: space.room, paddingTop: space.snug, gap: space.snug },
  stubRow: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  /** The state of the bill, as a capsule rather than a rubber stamp. */
  stamp: {
    borderWidth: 1.5,
    borderRadius: RADII.pill,
    paddingHorizontal: space.cosy,
    paddingVertical: 3,
  },
  stampText: { ...type.caption, fontSize: 12, ...fontFor(700), letterSpacing: 0.6 },
  /** Reference left, time right — one line, not two stacked ones. */
  docketMetaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
  },
  docketMeta: { ...type.caption, color: colors.subtle, fontVariant: ['tabular-nums'] },
  dottedRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
  },
  itemLine: { flexDirection: 'row', alignItems: 'baseline', gap: space.snug },
  itemName: { ...type.body, fontSize: 15, lineHeight: 20, color: colors.text, flexShrink: 1 },
  /** Fills whatever gap is left between the name and its figure. */
  leader: { flex: 1 },
  itemPrice: {
    ...type.body,
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  docketNote: { ...type.caption, fontSize: 14, lineHeight: 19, color: colors.subtle },

  cardTitle: { ...type.section, color: colors.text },

  /** Label left, fact right — scannable as a column without a table. */
  detailRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.room,
  },
  detailLabel: { ...type.body, color: colors.subtle },
  // The fact outweighs its label, and wraps rather than truncating.
  detailValue: {
    flexShrink: 1,
    ...type.body,
    color: colors.text,
    textAlign: 'right',
  },

  actions: { marginTop: space.section, gap: space.snug },
  /** Text-weight, but never smaller than a thumb. */
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  cancelText: { ...type.body, fontSize: 17, color: colors.dangerInk },
  restoreText: { ...type.body, fontSize: 17, color: colors.actionInk },

  // The total, right-aligned against the status so the two read as one line.
  billLine: { flex: 1, alignItems: 'flex-end' },
  billHeading: { ...type.caption, ...fontFor(600), color: colors.subtle },
  billAmount: { ...type.title, fontVariant: ['tabular-nums'] },
  // Amber, not red: a bigger bill is news to explain, not an error.
  billDifference: { ...type.caption, ...fontFor(600), color: colors.moneyOut },
  billReward: { ...type.caption, ...fontFor(600), color: colors.moneyIn },

  evidence: { gap: space.tight, marginTop: space.tight },
  evidenceFrame: {
    height: 180,
    borderRadius: RADII.control,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: colors.sunken,
  },
  evidencePhoto: { width: '100%', height: '100%' },
  /** In the slip's own small print, as a caption under a pasted photo. */
  evidenceCaption: { ...type.caption, color: colors.subtle },
});
