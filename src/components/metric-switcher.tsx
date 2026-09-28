/**
 * Four figures that double as the chart's switch, Shopee Seller Centre style:
 * the selected tile is the one the hero and the bars are showing. Each carries
 * its own little arrow so a glance across the row reads the whole period.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { METRIC_LOOKS, formatMetric } from '@/lib/domain/sales-display';
import { METRIC_KEYS, type MetricKey, type MetricSummary } from '@/lib/domain/sales-metrics';

import { RADII, TAG_TONES, colors, elevation, space, type } from './ui-kit';

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <Text style={styles.trendFlat}>new</Text>;
  const isUp = pct > 0;
  const tone = pct === 0 ? TAG_TONES.neutral : isUp ? TAG_TONES.settled : TAG_TONES.owed;
  return (
    <View style={styles.trend}>
      {pct === 0 ? null : (
        <Ionicons name={isUp ? 'caret-up' : 'caret-down'} size={10} color={tone.ink} />
      )}
      <Text style={[styles.trendText, { color: tone.ink }]}>{`${Math.abs(pct)}%`}</Text>
    </View>
  );
}

export function MetricSwitcher({
  metrics,
  value,
  onChange,
}: {
  metrics: Record<MetricKey, MetricSummary>;
  value: MetricKey;
  onChange: (next: MetricKey) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {METRIC_KEYS.map((key) => {
        const metric = metrics[key];
        const look = METRIC_LOOKS[key];
        const isOn = key === value;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isOn }}
            accessibilityLabel={`${look.label}, ${formatMetric(key, metric.total)}`}
            style={({ pressed }) => [styles.tile, isOn && styles.tileOn, pressed && styles.pressed]}
          >
            <Text style={[styles.label, isOn && styles.labelOn]} numberOfLines={1}>
              {look.label}
            </Text>
            <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
              {formatMetric(key, metric.total)}
            </Text>
            <Trend pct={metric.deltaPct} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.snug - 2 },
  tile: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingVertical: space.snug,
    paddingHorizontal: space.snug,
    borderRadius: RADII.control,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  tileOn: { backgroundColor: colors.card, borderColor: colors.moneyIn, ...elevation.lift },
  pressed: { opacity: 0.75 },
  label: { ...type.caption, fontSize: 11, color: colors.subtle },
  labelOn: { color: colors.moneyIn, fontWeight: '700' },
  value: { ...type.label, fontSize: 15, color: colors.text },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  trendText: { fontSize: 11, fontWeight: '700' },
  trendFlat: { fontSize: 11, color: colors.subtle },
});