/**
 * Where the money went: one bar per category, biggest first.
 *
 * Horizontal bars rather than a pie, because the question an owner asks is
 * "which is biggest, and by how much", and lengths side by side answer it at
 * a glance where slices do not. Drawn with Views like the sales chart.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LOOKS } from '@/lib/domain/expense-categories';
import type { CategoryShare } from '@/lib/domain/expense-metrics';
import { formatMoney } from '@/lib/domain/money';

import { RADII, colors, elevation, space, type } from './ui-kit';

export function ExpenseBreakdown({ shares }: { shares: readonly CategoryShare[] }) {
  const largest = shares[0]?.amount ?? 0;

  return (
    <View style={styles.card}>
      {shares.map((share) => (
        <View
          key={share.key}
          style={styles.row}
          accessible
          accessibilityLabel={`${share.label}: ${formatMoney(share.amount)}, ${share.share} percent`}
        >
          <View style={styles.head}>
            <Ionicons name={CATEGORY_LOOKS[share.key].icon as never} size={16} color={colors.subtle} />
            <Text style={styles.label}>{share.label}</Text>
            <Text style={styles.share}>{share.share}%</Text>
            <Text style={styles.amount}>{formatMoney(share.amount)}</Text>
          </View>
          <View style={styles.track}>
            <View
              style={[styles.bar, { width: `${largest > 0 ? Math.max(2, (share.amount / largest) * 100) : 0}%` }]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.cosy,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  row: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  label: { ...type.label, color: colors.text, flex: 1 },
  share: { ...type.caption, color: colors.subtle },
  amount: { ...type.label, color: colors.text, minWidth: 96, textAlign: 'right' },
  track: { height: 8, borderRadius: RADII.pill, backgroundColor: colors.sunken, overflow: 'hidden' },
  bar: { height: 8, borderRadius: RADII.pill, backgroundColor: colors.moneyOut },
});
