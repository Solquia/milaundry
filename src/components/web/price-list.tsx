/**
 * The price list: one grid, every service in it.
 *
 * The list used to carry a heading per category, which on a shop with one or
 * two services per group meant a label, a card, a gap, another label — the
 * cards never formed a grid at all, they read as a column of lonely boxes
 * with a lot of air between them. Each card wears its own category in its
 * corner now, so the headings are gone and the cards close up into a single
 * block. The order still follows the category order, so related services
 * remain neighbours.
 *
 * Tapping a card opens the booking page with that service already in the
 * basket; when the shop cannot take bookings the cards are just cards.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ServiceTileCard } from '@/components/service-tile-card';
import { colors, space, type } from '@/components/ui-kit';
import { CATEGORY_SHORT, groupServicesByCategory } from '@/lib/domain/service-catalog';
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
  const bookTone = { bg: theme.brand, ink: theme.onBrand };
  // Flattened, but still in category order, so the grid reads as one block
  // without scattering the services that belong together.
  const ordered = groups.flatMap((group) =>
    group.services.map((service) => ({ service, label: CATEGORY_SHORT[group.category] }))
  );

  if (ordered.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No prices posted yet</Text>
        <Text style={styles.emptyBody}>Call the shop and they will quote you.</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {pairs(ordered).map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((entry, column) =>
            entry ? (
              <ServiceTileCard
                key={entry.service.id}
                service={entry.service}
                categoryLabel={entry.label}
                bookTone={bookTone}
                onBook={onBook ? () => onBook(entry.service.id) : undefined}
              />
            ) : (
              <View key={`blank-${column}`} style={styles.blank} />
            )
          )}
        </View>
      ))}
      {onBook ? <Text style={styles.footnote}>Tap a service to book it.</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Tight: the cards are one block, not a list of separated panels. */
  list: { gap: space.snug },
  row: { flexDirection: 'row', gap: space.snug, alignItems: 'stretch' },
  blank: { flex: 1 },
  footnote: { ...type.caption, color: colors.subtle, paddingHorizontal: space.tight, marginTop: space.tight },
  empty: {
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: space.section,
    gap: space.tight,
  },
  emptyTitle: { ...type.section, color: colors.text },
  emptyBody: { ...type.body, color: colors.subtle },
});