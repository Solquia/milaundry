/**
 * The price list as a grid of service cards.
 *
 * Two to a row, each a white card with the thing itself standing on it. A
 * customer arriving from a search is choosing what to bring, not reading a
 * table, and a grid answers that faster than a column of rows: eight services
 * fit in two thumbs of scrolling and each one is a picture before it is a
 * price.
 *
 * Categories are quiet labels between the rows, there for a long list and
 * invisible in a short one. Tapping a card opens the booking page with that
 * service already in the basket; when the shop cannot take bookings the cards
 * are just cards.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ServiceTileCard } from '@/components/service-tile-card';
import { colors, space, type } from '@/components/ui-kit';
import { CATEGORY_LABELS, groupServicesByCategory } from '@/lib/domain/service-catalog';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontService } from '@/lib/types';

interface PriceListProps {
  services: readonly StorefrontService[];
  theme: StorefrontTheme;
  /** Books this service; absent when the shop is not taking bookings. */
  onBook?: (serviceId: string) => void;
}

/** Two to a row; an odd last card keeps its width with a blank beside it. */
function pairs<T>(items: readonly T[]): (T | null)[][] {
  const rows: (T | null)[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i], items[i + 1] ?? null]);
  }
  return rows;
}

export function PriceList({ services, theme, onBook }: PriceListProps) {
  const groups = groupServicesByCategory(services);
  const showLabels = groups.length > 1;
  const bookTone = { bg: theme.brand, ink: theme.onBrand };

  if (groups.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No prices posted yet</Text>
        <Text style={styles.emptyBody}>Call the shop and they will quote you.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {groups.map((group) => (
        <View key={group.category} style={styles.group}>
          {showLabels ? (
            <Text style={styles.label}>{CATEGORY_LABELS[group.category]}</Text>
          ) : null}
          {pairs(group.services).map((row, index) => (
            <View key={index} style={styles.row}>
              {row.map((service, column) =>
                service ? (
                  <ServiceTileCard
                    key={service.id}
                    service={service}
                    bookTone={bookTone}
                    onBook={onBook ? () => onBook(service.id) : undefined}
                  />
                ) : (
                  <View key={`blank-${column}`} style={styles.blank} />
                )
              )}
            </View>
          ))}
        </View>
      ))}
      {onBook ? <Text style={styles.footnote}>Tap a service to book it.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.section },
  group: { gap: space.cosy },
  row: { flexDirection: 'row', gap: space.cosy, alignItems: 'stretch' },
  blank: { flex: 1 },
  label: {
    ...type.label,
    color: colors.subtle,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontSize: 12,
    paddingHorizontal: space.tight,
  },
  footnote: { ...type.caption, color: colors.subtle, paddingHorizontal: space.tight },
  empty: {
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: space.section,
    gap: space.tight,
  },
  emptyTitle: { ...type.section, color: colors.text },
  emptyBody: { ...type.body, color: colors.subtle },
});