/**
 * One order on the counter's queue: two lines and one button.
 *
 * Each colour on the row means one thing. The glossy symbol tile on the left
 * is the stage the load is in; the button wears the colour — and the symbol —
 * of the stage it moves the load *into*, so "Dry" is already drying-orange
 * with a sun on it before it is pressed, and a column of buttons reads as the
 * next half-hour of work. Red is only ever overdue, amber only ever money
 * owed on laundry that is ready to go. Everything else is ink.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { OrderWithDetails } from '@/lib/api';
import { formatMoneyCompact } from '@/lib/domain/money';
import { orderCardLabel } from '@/lib/domain/order-board';
import { orderContact } from '@/lib/domain/order-contact';
import {
  queueTitle,
  showsUnpaid,
  statusLine,
  type RowAction,
} from '@/lib/domain/order-queue';

import type { OrderStatus } from '@/lib/domain/order-status';

import { GLASS_EDGE, GLASS_ELEVATION, glassFill } from './glass';
import { GlyphTile } from './stage-glyph';
import { RADII, STATUS_COLORS, TAG_TONES, colors, space, type } from './ui-kit';
import { fontFor } from '@/lib/domain/design-scale';

/** 10% of the stage colour: a tint the full-strength ink still reads on. */
const TINT = '1A';
const STAGE_TILE = 40;

/** Each stage's symbol, the same set the customer's tracker uses. */
const STAGE_ICONS: Record<OrderStatus, string> = {
  pending: 'receipt-outline',
  received: 'basket-outline',
  sorting: 'shirt-outline',
  washing: 'water-outline',
  drying: 'sunny-outline',
  folded: 'layers-outline',
  ready: 'bag-check-outline',
  completed: 'checkmark-circle-outline',
  cancelled: 'close-circle-outline',
};

/** The button's symbol: where it sends the load, or what it asks for. */
function actionIcon(action: RowAction): string {
  if (action.kind === 'collect') return 'wallet';
  if (action.kind === 'call') return 'call';
  return STAGE_ICONS[action.to].replace(/-outline$/, '');
}

function actionTone(action: RowAction): { bg: string; ink: string } {
  if (action.kind === 'collect') return TAG_TONES.owed;
  if (action.kind === 'call') return TAG_TONES.linked;
  const ink = STATUS_COLORS[action.to === 'completed' ? 'ready' : action.to];
  return { bg: `${ink}${TINT}`, ink };
}

export function QueueRow({
  order,
  now,
  action,
  isBusy,
  onOpen,
  onAction,
}: {
  order: OrderWithDetails;
  now: Date;
  /** The one step this row offers, or null for none. */
  action: RowAction | null;
  /** This row's step is being saved. */
  isBusy: boolean;
  onOpen: () => void;
  onAction: (action: RowAction) => void;
}) {
  const title = queueTitle(order);
  const contact = orderContact(order);
  // A phone number is a real way to reach someone; only the placeholder greys out.
  const isNamed = contact.isNamed || contact.phone !== null;
  const line = statusLine(order, now);
  const isEstimate = (order.final_total ?? null) === null && order.status !== 'cancelled';
  const total = formatMoneyCompact(order.final_total ?? order.estimated_total);
  const tone = action ? actionTone(action) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={orderCardLabel(order, now)}
      accessibilityHint="Opens the order"
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <GlyphTile
        icon={STAGE_ICONS[order.status]}
        color={STATUS_COLORS[order.status]}
        size={STAGE_TILE}
        isLifted={false}
      />
      <View style={styles.body}>
        <View style={styles.line}>
          <Text style={[styles.name, !isNamed && styles.nameUnnamed]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.total}>
            {total}
            {isEstimate ? <Text style={styles.est}> est</Text> : null}
          </Text>
        </View>
        <View style={styles.line}>
          {order.fulfillment === 'delivery' ? (
            <Ionicons
              name="bicycle"
              size={14}
              color={line.isOverdue ? colors.dangerInk : colors.subtle}
              accessibilityLabel="Delivery"
            />
          ) : null}
          {line.isOverdue ? (
            <Ionicons name="alarm" size={13} color={colors.dangerInk} accessibilityLabel="Overdue" />
          ) : null}
          <Text style={[styles.meta, line.isOverdue && styles.overdue]} numberOfLines={1}>
            {line.text}
          </Text>
          {showsUnpaid(order) ? <Text style={styles.owed}>Unpaid</Text> : null}
        </View>
      </View>
      {action && tone ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action.label}, ${title}`}
          accessibilityState={{ disabled: isBusy, busy: isBusy }}
          disabled={isBusy}
          hitSlop={6}
          onPress={() => onAction(action)}
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: tone.bg },
            pressed && styles.pressed,
          ]}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={tone.ink} />
          ) : (
            <>
              <Ionicons name={actionIcon(action) as never} size={15} color={tone.ink} />
              <Text style={[styles.actionText, { color: tone.ink }]} numberOfLines={1}>
                {action.label}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Near-white glass, the same pane as the tiles above it.
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingVertical: space.snug + 4,
    paddingLeft: space.snug + 4,
    paddingRight: space.snug + 2,
    borderRadius: 20,
    borderCurve: 'continuous',
    backgroundColor: glassFill(0.86),
    borderWidth: 1.5,
    borderColor: GLASS_EDGE,
    shadowColor: '#1B2559',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: GLASS_ELEVATION,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  // minWidth 0 lets a long name shrink instead of shoving the total off the row.
  body: { flex: 1, minWidth: 0, gap: 3 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: {
    ...type.label,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
    ...fontFor(600),
    flex: 1,
    color: colors.text,
  },
  nameUnnamed: { color: colors.subtle },
  total: {
    ...type.label,
    fontSize: 16,
    lineHeight: 21,
    letterSpacing: -0.2,
    ...fontFor(600),
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  est: { ...type.caption, color: colors.subtle },
  meta: { ...type.caption, flex: 1, color: colors.subtle },
  overdue: { color: colors.dangerInk, ...fontFor(600) },
  owed: { ...type.caption, ...fontFor(600), color: colors.moneyOut },
  action: {
    flexDirection: 'row',
    gap: 5,
    minWidth: 76,
    minHeight: 38,
    paddingHorizontal: space.cosy,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.pill,
  },
  actionText: { ...type.label, ...fontFor(600) },
});
