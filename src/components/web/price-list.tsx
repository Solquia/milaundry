/**
 * The price list on the shop own web page: the same shelf the app draws.
 *
 * This used to hold its own grid and its own card loop, which is how the web
 * and the app drifted apart twice — a change to the card landed on one and not
 * the other. The shelf component owns the search, the heading, the grid and
 * the cascade now, so this file is only what the web knows that the app does
 * not: the shop brand colours, how many cards fit the window, and that a
 * browser visitor has to be told a card is tappable.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ServiceShelf } from '@/components/service-shelf';
import { colors, space, type } from '@/components/ui-kit';
import { groupServicesByCategory, labelledServices } from '@/lib/domain/service-catalog';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontService } from '@/lib/types';

interface PriceListProps {
  services: readonly StorefrontService[];
  theme: StorefrontTheme;
  /** Books this service; absent when the shop is not taking bookings. */
  onBook?: (serviceId: string) => void;
  /** Cards to a row. Two on a phone, more as the window grows. */
  columns?: number;
}

export function PriceList({ services, theme, onBook, columns = 2 }: PriceListProps) {
  // Flattened, but still in category order, so the grid reads as one block
  // without scattering the services that belong together. The app's shop
  // screen orders its list through the same function.
  const ordered = labelledServices(groupServicesByCategory(services));

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
      <ServiceShelf
        entries={ordered}
        onBook={onBook ? (service) => onBook(service.id) : undefined}
        columns={columns}
        bookTone={{ bg: theme.brand, ink: theme.onBrand }}
        footnote={onBook ? 'Tap a card to book that service.' : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.snug },
  empty: {
    backgroundColor: colors.card,
    borderRadius: 26,
    padding: space.section,
    gap: space.tight,
  },
  emptyTitle: { ...type.section, color: colors.text },
  emptyBody: { ...type.body, color: colors.subtle },
});
