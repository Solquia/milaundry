/**
 * The menu side of the till.
 *
 * A strip of categories to narrow by, and a grid of tiles big enough to hit
 * with a thumb while the other hand holds a bag.
 *
 * The tiles are the shopfront's own price-board cards in basket mode, so the
 * counter and the customer look at the same drawing of the same service. A
 * tap puts a service on the ticket; once it is there the card shows the
 * amount at its top right and a stepper takes the rate's place.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  CATEGORY_LABELS,
  labelledServices,
  type ServiceGroup,
} from '@/lib/domain/service-catalog';
import { serviceLooks } from '@/lib/domain/service-look';
import { categoryIcon } from '@/lib/domain/shop-home';
import { gridRows } from '@/lib/domain/web-layout';
import type { ServiceRow } from '@/lib/types';

import { APP_TONE, type QuantityTone } from './quantity-picker';
import { ServiceTileCard } from './service-tile-card';
import { RADII, colors, space, type } from './ui-kit';

export const ALL_CATEGORIES = 'all';

export function CategoryStrip({
  groups,
  active,
  onChange,
  tone = APP_TONE,
}: {
  groups: ServiceGroup<ServiceRow>[];
  active: string;
  onChange: (category: string) => void;
  /** The shop's colour, so the strip agrees with the band above it. */
  tone?: QuantityTone;
}) {
  // One category is not a choice; the strip would be a single chip saying so.
  if (groups.length < 2) return null;
  const chips = [
    { key: ALL_CATEGORIES, label: 'All', icon: 'grid-outline' },
    ...groups.map((group) => ({
      key: group.category as string,
      label: CATEGORY_LABELS[group.category],
      icon: categoryIcon(group.category),
    })),
  ];

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      keyboardShouldPersistTaps="handled"
    >
      {chips.map((chip) => {
        const isActive = chip.key === active;
        return (
          <Pressable
            key={chip.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={chip.label}
            onPress={() => onChange(chip.key)}
            style={({ pressed }) => [
              styles.chip,
              isActive && { backgroundColor: tone.brand, borderColor: tone.brand },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={chip.icon as never}
              size={16}
              color={isActive ? colors.onAccent : colors.subtle}
            />
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function ServiceMenu({
  groups,
  active,
  quantities,
  onTap,
  onLess,
  tone = APP_TONE,
}: {
  groups: ServiceGroup<ServiceRow>[];
  active: string;
  quantities: Readonly<Record<string, number>>;
  onTap: (service: ServiceRow) => void;
  onLess: (service: ServiceRow) => void;
  /** The shop's colour, so a chosen tile agrees with the band above it. */
  tone?: QuantityTone;
}) {
  const shown =
    active === ALL_CATEGORIES ? groups : groups.filter((group) => group.category === active);
  const tiles = labelledServices(shown);
  // Across every category, so narrowing the strip never re-dyes a tile.
  const looks = React.useMemo(
    () => serviceLooks(labelledServices(groups).map((entry) => entry.service)),
    [groups]
  );
  const bookTone = { bg: tone.brand, ink: colors.onAccent };

  return (
    <View style={styles.menu}>
      {gridRows(tiles, 2).map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((entry, column) =>
            entry ? (
              <View key={entry.service.id} style={styles.column}>
                <ServiceTileCard
                  service={entry.service}
                  categoryLabel={entry.label}
                  look={looks.get(entry.service.id)}
                  bookTone={bookTone}
                  quantity={quantities[entry.service.id] ?? 0}
                  onAdd={() => onTap(entry.service)}
                  onRemove={() => onLess(entry.service)}
                />
              </View>
            ) : (
              <View key={`blank-${column}`} style={styles.blank} />
            )
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', gap: space.snug, paddingHorizontal: space.room },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    // The control a counter thumb hits most: never under the 44pt target.
    height: 44,
    paddingHorizontal: 14,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { ...type.label, color: colors.text },
  chipTextActive: { color: colors.onAccent },

  menu: { gap: space.snug },
  row: { flexDirection: 'row', gap: space.snug, alignItems: 'stretch' },
  /** A card in a row has to carry the column's width itself. */
  column: { flex: 1, minWidth: 0 },
  blank: { flex: 1 },

  pressed: { opacity: 0.7 },
});
