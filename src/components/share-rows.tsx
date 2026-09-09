/**
 * Parts of a whole, one row each: a name, its money, and a bar for its share.
 *
 * A pie would make the owner compare angles; a list of bars with the figure
 * printed beside each one lets them read the answer and glance at the shape.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, formatMoney, space, type } from './ui-kit';

export interface ShareItem {
  key: string;
  label: string;
  amount: number;
  /** Whole percent of the total. */
  share: number;
  note?: string;
}

export function ShareRows({
  items,
  emptyText,
}: {
  items: readonly ShareItem[];
  emptyText: string;
}) {
  if (items.length === 0) return <Text style={styles.empty}>{emptyText}</Text>;
  return (
    <View style={styles.list}>
      {items.map((item) => (
        <View
          key={item.key}
          style={styles.row}
          accessible
          accessibilityLabel={`${item.label}, ${formatMoney(item.amount)}, ${item.share} percent${
            item.note ? `, ${item.note}` : ''
          }`}
        >
          <View style={styles.head}>
            <Text style={styles.label} numberOfLines={1}>
              {item.label}
            </Text>
            <Text style={styles.share}>{item.share}%</Text>
            <Text style={styles.amount}>{formatMoney(item.amount)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min(100, item.share)}%` }]} />
          </View>
          {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.cosy },
  row: { gap: 6 },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.snug },
  label: { ...type.body, fontWeight: '500', color: colors.text, flex: 1 },
  share: { ...type.caption, color: colors.subtle },
  amount: { ...type.body, fontWeight: '700', color: colors.text },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, backgroundColor: colors.moneyIn },
  note: { ...type.caption, color: colors.subtle },
  empty: { fontSize: 14, color: colors.subtle },
});
