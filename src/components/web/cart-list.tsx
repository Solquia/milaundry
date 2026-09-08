/**
 * The ordering step: the price list with a basket in it.
 *
 * The same grid of cards the price list uses, so a customer who chose from
 * pictures a screen ago meets the same pictures here rather than a table of
 * words. A card holding nothing shows Add; one already on the ticket shows
 * what it holds between − and +. Whole units only: the shop weighs the load
 * anyway.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ServiceTileCard } from '@/components/service-tile-card';
import { colors, space, type } from '@/components/ui-kit';
import { CATEGORY_LABELS, groupServicesByCategory } from '@/lib/domain/service-catalog';
import { adjustLine, type Cart } from '@/lib/domain/web-cart';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontService } from '@/lib/types';

interface CartListProps {
  services: readonly StorefrontService[];
  cart: Cart;
  onChange: (next: Cart) => void;
  theme: StorefrontTheme;
}

/** Two to a row; an odd last card keeps its width with a blank beside it. */
function pairs<T>(items: readonly T[]): (T | null)[][] {
  const rows: (T | null)[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i], items[i + 1] ?? null]);
  }
  return rows;
}

export function CartList({ services, cart, onChange, theme }: CartListProps) {
  const groups = groupServicesByCategory(services);
  const showLabels = groups.length > 1;
  const bookTone = { bg: theme.brand, ink: theme.onBrand };

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
                    quantity={cart[service.id] ?? 0}
                    onAdd={() => onChange(adjustLine(cart, service, 1))}
                    onRemove={() => onChange(adjustLine(cart, service, -1))}
                  />
                ) : (
                  <View key={`blank-${column}`} style={styles.blank} />
                )
              )}
            </View>
          ))}
        </View>
      ))}
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
});