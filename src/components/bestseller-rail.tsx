/**
 * What sold, as a shelf of cards you swipe through, the way a food app shows
 * its best dishes: the service, how much of it went out in the counter's own
 * units, the money, and whether it is up on the period before.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatMoneyCompact } from '@/lib/domain/money';
import { quantityLabel } from '@/lib/domain/sales-display';
import type { Bestseller } from '@/lib/domain/sales-metrics';
import { serviceIcon } from '@/lib/domain/service-icon';

import { RADII, TAG_TONES, colors, elevation, space, type } from './ui-kit';

function Change({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <View style={[styles.chip, { backgroundColor: TAG_TONES.linked.bg }]}>
        <Text style={[styles.chipText, { color: TAG_TONES.linked.ink }]}>New</Text>
      </View>
    );
  }
  const tone = pct > 0 ? TAG_TONES.settled : pct < 0 ? TAG_TONES.owed : TAG_TONES.neutral;
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <Text style={[styles.chipText, { color: tone.ink }]}>
        {pct > 0 ? '▲' : pct < 0 ? '▼' : ''} {Math.abs(pct)}%
      </Text>
    </View>
  );
}

export function BestsellerRail({ items }: { items: readonly Bestseller[] }) {
  if (items.length === 0) {
    return <Text style={styles.empty}>Nothing sold in this period yet.</Text>;
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      style={styles.bleed}
    >
      {items.map((item, index) => (
        <View
          key={item.name}
          style={[styles.card, index === 0 && styles.cardTop]}
          accessible
          accessibilityLabel={`Number ${index + 1}: ${item.name}, ${quantityLabel(item.quantity, item.unit)}, ${formatMoneyCompact(item.revenue)}`}
        >
          <View style={styles.head}>
            <View style={[styles.icon, index === 0 && styles.iconTop]}>
              <Ionicons
                name={serviceIcon(item.name, 'other') as never}
                size={18}
                color={index === 0 ? '#8A5A00' : colors.actionInk}
              />
            </View>
            <Text style={[styles.rank, index === 0 && styles.rankTop]}>#{index + 1}</Text>
          </View>
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.quantity}>{quantityLabel(item.quantity, item.unit)}</Text>
          <View style={styles.foot}>
            <Text style={styles.revenue} numberOfLines={1} adjustsFontSizeToFit>
              {formatMoneyCompact(item.revenue)}
            </Text>
            <Change pct={item.deltaPct} />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -space.room },
  rail: { gap: space.snug, paddingHorizontal: space.room, paddingVertical: space.tight },
  card: {
    width: 150,
    gap: space.tight,
    padding: space.cosy,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  cardTop: { borderWidth: 1.5, borderColor: '#F6C453' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  icon: {
    width: 34,
    height: 34,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionSurface,
  },
  iconTop: { backgroundColor: '#FFF1CC' },
  rank: { ...type.caption, fontWeight: '800', color: colors.subtle },
  rankTop: { color: '#8A5A00' },
  name: { ...type.label, color: colors.text, minHeight: 36 },
  quantity: { ...type.caption, color: colors.subtle },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  revenue: { ...type.label, fontSize: 16, color: colors.text, flexShrink: 1 },
  chip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADII.pill },
  chipText: { fontSize: 11, fontWeight: '700' },
  empty: { ...type.body, color: colors.subtle },
});