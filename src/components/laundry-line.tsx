/**
 * The customer's loads, ordered by what happens next — two lines each.
 *
 *   ◜BG◝  Washing                      ~₱197
 *   ◟  ◞  8.5 kg · Back tomorrow 6 PM
 *
 * The shop is its logo; the ring around the logo is how far the load has got
 * (a fifth per stage, in the stage's colour). The first line is where it is,
 * in one word; the second is how much and when it is back. A ready load is the
 * same row in green, with a pay button only when money is actually owed.
 *
 * The ticket stub this replaced said the stage three times and the date the
 * laundry went in once, in a block a quarter of the card wide. The first
 * attempt after it said everything once but in too many words. This says it
 * in the fewest that still answer "where is it and when is it back".
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { LiftPressable } from '@/components/lift-pressable';
import { ShopLogo } from '@/components/shop-logo';
import { STATUS_COLORS, colors, elevation, space, type } from '@/components/ui-kit';
import { RADII } from '@/lib/domain/design-scale';
import {
  loadSize,
  moneyLabel,
  ringProgress,
  sortByNext,
  statusWord,
  whenLine,
  type LineOrder,
} from '@/lib/domain/laundry-line';
import type { OrderStatus } from '@/lib/domain/order-status';
import type { Accent } from '@/lib/domain/web-theme';

/** How a line draws the shop an order belongs to. */
export interface LineShop {
  name: string;
  logoUrl: string | null;
  accent: Accent;
}

interface LaundryLineProps<T extends LineOrder> {
  orders: readonly T[];
  now: Date;
  shopFor: (order: T) => LineShop;
  onOpen: (order: T) => void;
  /** Set on the web, where each load is a link to its tracking page. */
  isLink?: boolean;
}

export function LaundryLine<T extends LineOrder>({
  orders,
  now,
  shopFor,
  onOpen,
  isLink = false,
}: LaundryLineProps<T>) {
  return (
    <View style={styles.list}>
      {sortByNext(orders).map((order) => (
        <LoadRow
          key={order.id}
          order={order}
          shop={shopFor(order)}
          now={now}
          isLink={isLink}
          onPress={() => onOpen(order)}
        />
      ))}
    </View>
  );
}

function LoadRow({
  order,
  shop,
  now,
  isLink,
  onPress,
}: {
  order: LineOrder;
  shop: LineShop;
  now: Date;
  isLink: boolean;
  onPress: () => void;
}) {
  const word = statusWord(order.status);
  const when = whenLine(order, now);
  const detail = [loadSize(order.order_items), when.text].filter(Boolean).join(' · ');
  const money = moneyLabel(order);
  const isReady = order.status === 'ready';
  const isOver = order.status === 'completed' || order.status === 'cancelled';
  const tint = isReady ? colors.moneyIn : STATUS_COLORS[order.status];

  return (
    <LiftPressable
      accessibilityRole={isLink ? 'link' : 'button'}
      accessibilityLabel={`${shop.name}. ${word}. ${detail}. ${money.text}${
        money.kind === 'due' ? ' to pay' : ''
      }.`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        isReady && styles.rowReady,
        isOver && styles.rowOver,
        pressed && styles.pressed,
      ]}
    >
      <Ring status={order.status} color={tint}>
        <ShopLogo name={shop.name} logoUrl={shop.logoUrl} accent={shop.accent} size={LOGO} />
      </Ring>

      <View style={styles.text}>
        <Text style={[styles.word, { color: isOver ? colors.subtle : tint }]} numberOfLines={1}>
          {word}
        </Text>
        {detail ? (
          <Text
            style={[styles.detail, when.tone === 'late' && styles.detailLate]}
            numberOfLines={1}
          >
            {detail}
          </Text>
        ) : null}
      </View>

      {money.kind === 'due' ? (
        <View style={styles.pay}>
          <Text style={styles.payText}>Pay {money.text}</Text>
        </View>
      ) : money.kind === 'estimate' ? (
        <Text style={styles.money}>{money.text}</Text>
      ) : null}
    </LiftPressable>
  );
}

// ---------------------------------------------------------------------------
// The ring: how far along, drawn around the shop it is at.
// ---------------------------------------------------------------------------

const RING = 48;
const STROKE = 3;
const LOGO = 38;
const RADIUS = (RING - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function Ring({
  status,
  color,
  children,
}: {
  status: OrderStatus;
  color: string;
  children: React.ReactNode;
}) {
  const filled = ringProgress(status) * CIRCUMFERENCE;
  return (
    <View style={styles.ring}>
      {/* Turned a quarter back, so the ring fills from twelve o'clock. */}
      <Svg width={RING} height={RING} style={styles.ringArc}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          stroke={colors.border}
          strokeWidth={STROKE}
          fill="none"
        />
        {filled > 0 ? (
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={RADIUS}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            fill="none"
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.snug },
  pressed: { opacity: 0.85 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingVertical: space.snug + 2,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.control + 2,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  rowReady: {
    backgroundColor: colors.takingsSurface,
    borderWidth: 1,
    borderColor: colors.takingsBorder,
  },
  /** History, not news: flat and quiet. */
  rowOver: { backgroundColor: colors.sunken, shadowOpacity: 0, elevation: 0 },

  text: { flex: 1, minWidth: 0, gap: 1 },
  word: { ...type.label, fontSize: 16, lineHeight: 21 },
  detail: { ...type.caption, color: colors.subtle },
  detailLate: { color: colors.dangerInk },

  money: { ...type.label, fontSize: 13, color: colors.subtle },
  pay: {
    paddingHorizontal: space.cosy,
    paddingVertical: space.tight + 2,
    borderRadius: RADII.pill,
    backgroundColor: colors.moneyIn,
  },
  payText: { ...type.label, fontSize: 13, color: colors.onAccent },

  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringArc: { position: 'absolute', transform: [{ rotate: '-90deg' }] },
});
