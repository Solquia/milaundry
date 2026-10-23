/**
 * One day's money on the Customers screen: cash that came in, and what that
 * day's orders still owe, side by side and never added together.
 *
 * Owners asked for this because unpaid laundry can sit for days before
 * pickup, and a single total could not tell them what the day really took.
 * The arrows step back a day at a time so last Tuesday can be checked too.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dayCash, type DayCashOrder } from '@/lib/domain/day-cash';
import { frameFor } from '@/lib/domain/sales-period';

import { glassPane } from './glass';
import { RADII, colors, formatMoney, space, type } from './ui-kit';

const count = (n: number, noun: string): string => `${n} ${noun}${n === 1 ? '' : 's'}`;

function StepButton({
  icon,
  label,
  isDisabled,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  isDisabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.step, pressed && styles.pressed, isDisabled && styles.off]}
    >
      <Ionicons name={icon} size={18} color={colors.actionInk} />
    </Pressable>
  );
}

export function DayCashStrip({
  orders,
  now,
  onOpenOwing,
}: {
  orders: readonly DayCashOrder[];
  now: Date;
  onOpenOwing: () => void;
}) {
  // 0 is today, −1 yesterday; never in the future.
  const [offset, setOffset] = useState(0);
  const frame = useMemo(() => frameFor({ kind: 'day', offset }, now), [offset, now]);
  const cash = useMemo(() => dayCash(orders, frame), [orders, frame]);
  const isToday = offset === 0;
  const hasOwed = cash.toCollect > 0;
  const heading = isToday ? `Today · ${frame.caption}` : frame.caption;

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <StepButton
          icon="chevron-back"
          label="Previous day"
          isDisabled={false}
          onPress={() => setOffset(offset - 1)}
        />
        <Text style={styles.heading} numberOfLines={1}>
          {heading}
        </Text>
        <StepButton
          icon="chevron-forward"
          label="Next day"
          isDisabled={isToday}
          onPress={() => setOffset(Math.min(0, offset + 1))}
        />
      </View>
      <View style={styles.figures}>
        <View
          style={styles.cell}
          accessible
          accessibilityLabel={`Cash in ${formatMoney(cash.cashIn)} from ${count(cash.paidCount, 'payment')}`}
        >
          <Text style={[styles.value, { color: colors.moneyIn }]} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(cash.cashIn)}
          </Text>
          <Text style={styles.label} numberOfLines={1}>
            Cash in · {count(cash.paidCount, 'payment')}
          </Text>
        </View>
        <View style={styles.rule} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            hasOwed
              ? `${formatMoney(cash.toCollect)} still to collect from ${count(cash.unpaidCount, 'order')} taken this day. Show who owes.`
              : 'Every order taken this day is paid'
          }
          disabled={!hasOwed}
          onPress={onOpenOwing}
          style={({ pressed }) => [styles.cell, pressed && styles.pressed]}
        >
          <Text
            style={[styles.value, { color: hasOwed ? colors.moneyOut : colors.subtle }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {formatMoney(cash.toCollect)}
          </Text>
          <Text style={styles.label} numberOfLines={1}>
            {hasOwed ? `To collect · ${count(cash.unpaidCount, 'order')}` : 'Nothing to collect'}
          </Text>
        </Pressable>
      </View>
      <Text style={styles.note}>
        Unpaid laundry counts as cash on the day the customer pays.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...glassPane, borderRadius: RADII.card, padding: space.cosy, gap: space.snug },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  heading: { flex: 1, ...type.label, color: colors.text, textAlign: 'center' },
  step: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  off: { opacity: 0.3 },
  figures: { flexDirection: 'row', alignItems: 'stretch' },
  cell: { flex: 1, minWidth: 0, gap: 2, paddingHorizontal: space.snug, borderRadius: RADII.control },
  rule: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(60, 60, 67, 0.12)' },
  value: { ...type.value, fontSize: 22, letterSpacing: -0.3 },
  label: { ...type.caption, color: colors.subtle },
  note: { ...type.caption, color: colors.subtle, textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
