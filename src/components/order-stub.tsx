/**
 * A load in the wash, as the stub of its ticket.
 *
 * The shape is the ticket the shop keeps: a colour block at the tear, two
 * punched holes, a dashed seam, and the body on receipt stock with the docket
 * in the same monospace the printed slip uses. Tapping it opens something
 * recognisably larger rather than something else.
 *
 * The block carries the counter's date chop — when this load was taken in —
 * which is the one fact the rest of the stub does not already say. The stage,
 * the progress and the money are on the body, where they can be read at arm's
 * length without decoding a picture.
 *
 * One component for both halves of the product: the customer's home in the app
 * and their order list on a shop's web page drew two different cards for the
 * same thing, and only one of them looked like a ticket.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateChop } from './date-chop';
import {
  STATUS_COLORS,
  STATUS_LABELS,
  colors,
  elevation,
  formatMoney,
  mono,
  space,
  type,
} from './ui-kit';
import { docketNumber } from '@/lib/domain/docket';
import type { OrderStatus } from '@/lib/domain/order-status';
import { chopDate } from '@/lib/domain/ticket-stamp';
import type { Accent } from '@/lib/domain/web-theme';
import { cycleStanding, washCycleProgress } from '@/lib/domain/wash-cycle';

/** The block the chop is pressed onto — the ticket's band, stood on its end. */
const BLOCK_WIDTH = 76;
/** How far the punched holes bite in at the seam. */
const STUB_NOTCH = 16;

/** Everything the stub reads off an order, and nothing else. */
export interface StubOrder {
  id: string;
  status: OrderStatus;
  estimated_total: number;
  final_total: number | null;
  created_at: string;
}

interface OrderStubProps {
  order: StubOrder;
  shopName: string;
  /** The laundry's own tone: the block, and the chop's ink on it. */
  accent: Accent;
  onPress: () => void;
  /** Set on the web, where a stub is a link to a tracking page. */
  isLink?: boolean;
}

export function OrderStub({ order, shopName, accent, onPress, isLink }: OrderStubProps) {
  const progress = washCycleProgress(order.status);
  const standing = cycleStanding(order.status);
  const stageColor = STATUS_COLORS[order.status];
  const docket = docketNumber(order.id);
  const chop = chopDate(order.created_at);
  const amount = formatMoney(order.final_total ?? order.estimated_total);
  const isEstimate = order.final_total === null;

  return (
    <Pressable
      accessibilityRole={isLink ? 'link' : 'button'}
      // The spoken label carries the position and the date too: the bar, the
      // block and the chop are sighted shorthand, and a screen reader gets the
      // whole sentence instead.
      accessibilityLabel={[
        shopName,
        STATUS_LABELS[order.status],
        standing.caption,
        `${amount}${isEstimate ? ' estimated' : ''}`,
        chop ? `taken in ${chop.day} ${chop.month} ${chop.year}` : null,
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.stub, pressed && { opacity: 0.85 }]}
    >
      {/* The stub's end block, in the laundry's own tone. A 6px spine was the
          same idea whispered: it read as a rule left on a list row, not as a
          piece of the ticket. */}
      <View style={[styles.block, { backgroundColor: accent.ink }]}>
        {chop ? <DateChop chop={chop} ink={accent.surface} /> : null}
      </View>

      {/* The punch and the dashed seam: where a real stub is torn from its
          ticket. The circles are page-coloured and clipped by the card, so the
          bite is a clip rather than a shape kept in sync with the height. */}
      <View style={[styles.notch, styles.notchTop]} />
      <View style={[styles.notch, styles.notchBottom]} />
      <View style={styles.seam} />

      <View style={styles.body}>
        <View style={styles.head}>
          <Text style={styles.shop} numberOfLines={1}>
            {shopName}
          </Text>
          {docket ? <Text style={styles.docket}>NO. {docket}</Text> : null}
        </View>

        {/* The cycle as one line rather than five. The bar carries the same
            status hue the order screen's tracker uses, so the two agree. */}
        <View style={styles.track}>
          <View
            style={[styles.fill, { width: `${progress.percent}%`, backgroundColor: stageColor }]}
          />
        </View>

        <View style={styles.foot}>
          <Text style={[styles.stage, { color: stageColor }]} numberOfLines={1}>
            {STATUS_LABELS[order.status]}
          </Text>
          {/* Only once the cycle has begun: before that the caption reads "Not
              started yet", which the stage word beside it has already said. */}
          {standing.position > 0 ? <Text style={styles.step}>{standing.caption}</Text> : null}
          <Text style={styles.amount}>
            {amount}
            {isEstimate ? ' est.' : ''}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /**
   * Roughly a third of the height the old tracker card took, so three loads
   * are a glanceable list rather than three screenfuls.
   */
  stub: {
    flexDirection: 'row',
    // Paper, like the ticket it is a stub of, rather than another white card.
    backgroundColor: colors.paper,
    borderRadius: 16,
    // Clips the block and the punched holes to the card's own shape.
    overflow: 'hidden',
    ...elevation.lift,
  },
  block: { width: BLOCK_WIDTH, alignItems: 'center', justifyContent: 'center' },
  /** Page-coloured holes punched at the seam; the card's clip does the cutting. */
  notch: {
    position: 'absolute',
    left: BLOCK_WIDTH - STUB_NOTCH / 2,
    width: STUB_NOTCH,
    height: STUB_NOTCH,
    borderRadius: STUB_NOTCH / 2,
    backgroundColor: colors.bg,
  },
  notchTop: { top: -STUB_NOTCH / 2 },
  notchBottom: { bottom: -STUB_NOTCH / 2 },
  /** The tear line between the block and the body, inset past both punches. */
  seam: {
    position: 'absolute',
    left: BLOCK_WIDTH,
    top: STUB_NOTCH / 2,
    bottom: STUB_NOTCH / 2,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.paperRule,
  },
  body: { flex: 1, paddingHorizontal: space.room, paddingVertical: space.cosy, gap: space.snug },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.snug },
  shop: { flex: 1, ...type.section, fontSize: 17, color: colors.text },
  /** The same number, in the same face, as the ticket this is a stub of. */
  docket: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, color: colors.subtle },
  track: { height: 5, borderRadius: 3, backgroundColor: colors.paperRule, overflow: 'hidden' },
  fill: { height: 5, borderRadius: 3 },
  foot: { flexDirection: 'row', alignItems: 'baseline', gap: space.snug },
  // The state, in the state's own colour, set the way a ticket sets a class of
  // travel. It does the badge's job, so the row carries no second object.
  stage: { ...type.label, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' },
  step: { fontFamily: mono, fontSize: 11, color: colors.subtle },
  // `auto` rather than a flexed sibling: the step text is absent before the
  // cycle starts, and the figure has to hold the right edge either way.
  amount: {
    marginLeft: 'auto',
    fontFamily: mono,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
});
