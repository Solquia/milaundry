/**
 * The price list as a showcase.
 *
 * Every service is a card with a face: a tile in the colour of its kind, the
 * name as a title, a line about it, the price, and a Book sticker in the
 * shop's own colour. The web page has nothing under the list but the shop's
 * details, so every card is open — a customer who arrived from a search reads
 * every price without a tap. Categories are quiet labels between the cards,
 * there for a long list and invisible in a short one.
 *
 * A card is the fastest way to book: tapping it opens the booking page with
 * that service already in the basket. When the shop cannot take bookings the
 * cards are just cards, and the sticker is not there to promise otherwise.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ServiceShowcaseCard } from '@/components/service-showcase-card';
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
          {group.services.map((service) => (
            <ServiceShowcaseCard
              key={service.id}
              service={service}
              bookTone={bookTone}
              onBook={onBook ? () => onBook(service.id) : undefined}
            />
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.section,
    gap: space.tight,
  },
  emptyTitle: { ...type.section, color: colors.text },
  emptyBody: { ...type.body, color: colors.subtle },
});
