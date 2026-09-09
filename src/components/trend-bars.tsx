/**
 * How the money came in over the window, as a row of bars.
 *
 * Drawn with plain views rather than a chart library: there is one series,
 * no axes to label beyond a few dates, and nothing to hover. The bar for the
 * bucket the clock is in is the only one at full green; the rest step back,
 * so "today against the week" is read without a legend. Empty buckets keep a
 * hairline stub so a quiet day is a short bar, not a gap that looks like a
 * missing day.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TrendPoint } from '@/lib/domain/earnings-summary';

import { colors, space, type } from './ui-kit';

const CHART_HEIGHT = 88;
const STUB = 3;
/** Past this many bars the axis shows three dates instead of one per bar. */
const DENSE_FROM = 8;

export function TrendBars({
  points,
  peak,
  accessibilityLabel,
}: {
  points: readonly TrendPoint[];
  peak: number;
  accessibilityLabel: string;
}) {
  const isDense = points.length >= DENSE_FROM;
  const axis = isDense
    ? [points[0], points[Math.floor(points.length / 2)], points[points.length - 1]]
    : points;

  return (
    <View accessible accessibilityLabel={accessibilityLabel}>
      <View style={[styles.bars, { gap: isDense ? 2 : 6 }]}>
        {points.map((point, index) => {
          const isEmpty = point.amount <= 0;
          const height = isEmpty
            ? STUB
            : Math.max(STUB, Math.round((point.amount / peak) * CHART_HEIGHT));
          return (
            <View key={index} style={styles.slot}>
              <View
                style={[
                  styles.bar,
                  { height },
                  isEmpty ? styles.barEmpty : point.isCurrent ? styles.barCurrent : styles.barPast,
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={[styles.axis, isDense && styles.axisSpread]}>
        {axis.map((point, index) => (
          <Text
            key={index}
            style={[
              styles.axisLabel,
              !isDense && styles.axisCell,
              point.isCurrent && styles.axisCurrent,
            ]}
            numberOfLines={1}
          >
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT },
  slot: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 3 },
  barCurrent: { backgroundColor: colors.moneyIn },
  barPast: { backgroundColor: colors.moneyIn, opacity: 0.32 },
  barEmpty: { backgroundColor: colors.border },
  axis: { flexDirection: 'row', marginTop: space.snug },
  axisSpread: { justifyContent: 'space-between' },
  axisLabel: { ...type.caption, color: colors.subtle },
  axisCell: { flex: 1, textAlign: 'center' },
  axisCurrent: { color: colors.text, fontWeight: '600' },
});
