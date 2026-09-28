/**
 * The period as bars, with the period before it standing behind as a ghost.
 *
 * Each slot has two marks: a pale, full-width block for the comparison
 * period (yesterday at this hour, last week on this day) and the real bar in
 * front of it. So "am I ahead?" is read slot by slot without a legend, and the
 * hours still to come show only the ghost: what yesterday did next. Tap a bar
 * and its figures appear above the chart, the way Shopify's tooltips do,
 * without needing a hover a phone does not have.
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMetric, visibleRange } from '@/lib/domain/sales-display';
import type { MetricKey } from '@/lib/domain/sales-metrics';
import type { BucketUnit, PeriodBucket } from '@/lib/domain/sales-period';

import { RADII, colors, space, type } from './ui-kit';

const CHART_HEIGHT = 120;
const STUB = 3;
/** Past this many bars the axis prints a handful of labels instead of one per bar. */
const DENSE_FROM = 10;
const AXIS_MARKS = 5;

export function SalesChart({
  buckets,
  series,
  compareSeries,
  metric,
  unit,
  compareLabel,
}: {
  buckets: readonly PeriodBucket[];
  series: readonly number[];
  compareSeries: readonly number[];
  metric: MetricKey;
  unit: BucketUnit;
  compareLabel: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const { from, to } = visibleRange(unit, series, compareSeries);
  const indexes = useMemo(() => Array.from({ length: to - from }, (_, i) => from + i), [from, to]);
  const peak = Math.max(1, ...indexes.map((i) => Math.max(series[i] ?? 0, compareSeries[i] ?? 0)));
  const isDense = indexes.length >= DENSE_FROM;
  const step = Math.max(1, Math.ceil(indexes.length / AXIS_MARKS));
  const ink = metric === 'sales' ? colors.moneyIn : colors.action;
  const currentAt = indexes.findIndex((index) => buckets[index].isCurrent);
  // The current bar always gets its label; a scheduled label too close to it
  // gives way, so two 36px labels never land on top of each other.
  const isLabelled = (position: number): boolean => {
    if (!isDense || position === currentAt) return true;
    if (position % step !== 0) return false;
    return currentAt < 0 || Math.abs(position - currentAt) >= Math.ceil(step / 2) + 1;
  };
  const shown = picked !== null && picked >= from && picked < to ? picked : null;

  const heightOf = (value: number) => (value <= 0 ? STUB : Math.max(STUB, Math.round((value / peak) * CHART_HEIGHT)));

  return (
    <View style={styles.wrap}>
      <View style={styles.readout}>
        {shown !== null ? (
          <Text style={styles.readoutText} numberOfLines={1}>
            <Text style={styles.readoutStrong}>{buckets[shown].label}</Text>
            {`  ${buckets[shown].isFuture ? '—' : formatMetric(metric, series[shown] ?? 0)}`}
            <Text style={styles.readoutGhost}>{`  · ghost ${formatMetric(metric, compareSeries[shown] ?? 0)}`}</Text>
          </Text>
        ) : (
          <Text style={styles.readoutHint} numberOfLines={1}>
            Tap a bar · pale blocks are {compareLabel}
          </Text>
        )}
      </View>
      <View style={[styles.bars, { gap: isDense ? 2 : 5 }]}>
        {indexes.map((index) => {
          const bucket = buckets[index];
          const value = series[index] ?? 0;
          const ghost = compareSeries[index] ?? 0;
          const isPicked = shown === index;
          return (
            <Pressable
              key={bucket.start}
              style={styles.slot}
              onPress={() => setPicked(isPicked ? null : index)}
              accessibilityRole="button"
              accessibilityLabel={`${bucket.label}: ${bucket.isFuture ? 'not yet' : formatMetric(metric, value)}, compared with ${formatMetric(metric, ghost)}`}
            >
              <View style={[styles.ghost, { height: heightOf(ghost) }, isPicked && styles.ghostPicked]} />
              {bucket.isFuture ? null : (
                <View
                  style={[
                    styles.bar,
                    { height: heightOf(value), backgroundColor: value <= 0 ? colors.borderStrong : ink },
                    !bucket.isCurrent && !isPicked && value > 0 && styles.barPast,
                  ]}
                />
              )}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {indexes.map((index, position) => {
          const bucket = buckets[index];
          const isMarked = isLabelled(position);
          return (
            <View key={bucket.start} style={styles.axisCell}>
              {isMarked ? (
                <Text style={[styles.axisLabel, bucket.isCurrent && styles.axisCurrent]} numberOfLines={1}>
                  {bucket.label}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.tight },
  readout: { minHeight: 20, justifyContent: 'center' },
  readoutText: { ...type.caption, color: colors.text },
  readoutStrong: { fontWeight: '700' },
  readoutGhost: { color: colors.subtle },
  readoutHint: { ...type.caption, color: colors.subtle },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT },
  slot: { flex: 1, height: CHART_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' },
  ghost: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: RADII.hair / 2,
    borderTopRightRadius: RADII.hair / 2,
    backgroundColor: 'rgba(90, 107, 125, 0.13)',
  },
  ghostPicked: { backgroundColor: 'rgba(90, 107, 125, 0.24)' },
  bar: { width: '62%', minWidth: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barPast: { opacity: 0.55 },
  axis: { flexDirection: 'row' },
  axisCell: { flex: 1, alignItems: 'center', overflow: 'visible' },
  // Wider than a dense cell on purpose: '12p' must not truncate to '1…' in a 9px slot.
  axisLabel: { width: 36, ...type.caption, fontSize: 11, color: colors.subtle, textAlign: 'center' },
  axisCurrent: { color: colors.text, fontWeight: '700' },
});