/**
 * One order on the counter's queue: two lines and one button.
 *
 * Each colour on the row means one thing. The left edge is the stage the load
 * is in; the button wears the colour of the stage it moves the load *into*, so
 * "Dry" is already drying-orange before it is pressed and a column of buttons
 * reads as the next half-hour of work. Red is only ever overdue, amber only
 * ever money owed on laundry that is ready to go. Everything else is ink.
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

import { RADII, STATUS_COLORS, TAG_TONES, colors, space, type } from './ui-kit';

/** 10% of the stage colour: a tint the full-strength ink still reads on. */
const TINT = '1A';

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
      <View style={[styles.stage, { backgroundColor: STATUS_COLORS[order.status] }]} />
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
            <Text style={[styles.actionText, { color: tone.ink }]} numberOfLines={1}>
              {action.label}
            </Text>
          )}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingVertical: space.cosy,
    paddingLeft: space.cosy,
    paddingRight: space.snug + 2,
    borderRadius: RADII.control,
    backgroundColor: colors.card,
  },
  pressed: { opacity: 0.75 },
  stage: { alignSelf: 'stretch', width: 4, borderRadius: 2 },
  // minWidth 0 lets a long name shrink instead of shoving the total off the row.
  body: { flex: 1, minWidth: 0, gap: 2 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { ...type.label, fontSize: 16, lineHeight: 21, flex: 1, color: colors.text },
  nameUnnamed: { color: colors.subtle },
  total: { ...type.label, fontSize: 16, lineHeight: 21, color: colors.text },
  est: { ...type.caption, color: colors.subtle },
  meta: { ...type.caption, flex: 1, color: colors.subtle },
  overdue: { color: colors.dangerInk, fontFamily: type.label.fontFamily },
  owed: { ...type.caption, fontFamily: type.label.fontFamily, color: colors.moneyOut },
  action: {
    minWidth: 72,
    minHeight: 40,
    paddingHorizontal: space.cosy,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.pill,
  },
  actionText: { ...type.label },
});
