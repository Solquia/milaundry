/**
 * The ordering step: categories down the side, their services beside them.
 *
 * Every category used to stack down one column, so a shop with five of them
 * was a long scroll and the price list was the whole page. Now the categories
 * are a rail on the left and one category's services fill the grid on the
 * right — the shape a laundry app has when it expects you to browse rather
 * than read.
 *
 * The rail turns the categories you are not looking at into closed doors, so
 * each one carries a count of what it already holds. That rule, and which
 * category opens on arrival, are `domain/service-rail.ts`.
 *
 * The controls on a card are the app's, not a second set. `adjustLine` starts
 * a line at the shop's minimum and steps it by one whole unit, so a 3 kg
 * minimum never shows "1 kg" and gets billed as three. A per-kg line counts
 * kilos and a per-piece line counts pieces, in the same words the app uses.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ServiceTileCard } from '@/components/service-tile-card';
import { RADII, colors, space, type } from '@/components/ui-kit';
import { railLineCount, selectedRailCategory } from '@/lib/domain/service-rail';
import { CATEGORY_LABELS, groupServicesByCategory } from '@/lib/domain/service-catalog';
import { categoryIcon } from '@/lib/domain/shop-home';
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
  const [picked, setPicked] = useState<string | null>(null);
  const current = selectedRailCategory(groups, picked);
  const shown = groups.find((group) => group.category === current);
  const bookTone = { bg: theme.brand, ink: theme.onBrand };

  // One category is not a choice, so it gets no rail — the grid is the page.
  const hasRail = groups.length > 1;

  return (
    <View style={styles.frame}>
      {hasRail ? (
        <ScrollView
          style={styles.rail}
          contentContainerStyle={styles.railInner}
          showsVerticalScrollIndicator={false}
        >
          {groups.map((group) => {
            const isOn = group.category === current;
            const held = railLineCount(cart, group.services);
            return (
              <Pressable
                key={group.category}
                accessibilityRole="tab"
                accessibilityState={{ selected: isOn }}
                accessibilityLabel={
                  held > 0
                    ? `${CATEGORY_LABELS[group.category]}, ${held} in your basket`
                    : CATEGORY_LABELS[group.category]
                }
                onPress={() => setPicked(group.category)}
                style={[styles.railItem, isOn && { backgroundColor: theme.brandSoft }]}
              >
                {/* The lit edge, not a fill: the rail must stay quieter than
                    the cards it is pointing at. */}
                <View
                  style={[styles.railEdge, isOn && { backgroundColor: theme.brand }]}
                />
                <View style={styles.railBody}>
                  <Ionicons
                    name={categoryIcon(group.category) as never}
                    size={22}
                    color={isOn ? theme.brandInk : colors.subtle}
                  />
                  <Text
                    numberOfLines={2}
                    style={[styles.railText, isOn && { color: theme.brandInk }]}
                  >
                    {CATEGORY_LABELS[group.category]}
                  </Text>
                  {/* A closed door that says what is behind it. */}
                  {held > 0 ? (
                    <View style={[styles.railBadge, { backgroundColor: theme.brand }]}>
                      <Text style={[styles.railBadgeText, { color: theme.onBrand }]}>
                        {held}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.grid}>
        {/* The category's own name above its cards. The rail says which door is
            open; this says it again where the eye actually is. */}
        {hasRail && shown ? (
          <Text style={styles.gridLabel}>{CATEGORY_LABELS[shown.category]}</Text>
        ) : null}

        {shown
          ? pairs(shown.services).map((row, index) => (
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
            ))
          : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flexDirection: 'row', gap: space.cosy, alignItems: 'flex-start' },

  /** Narrow on purpose: the cards are the page, the rail only points at them. */
  rail: { width: 96, flexGrow: 0, flexShrink: 0 },
  railInner: { gap: space.snug, paddingBottom: space.snug },
  railItem: {
    flexDirection: 'row',
    borderRadius: RADII.chip,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  /** 3px lit edge, the same weight the step rail used for progress. */
  railEdge: { width: 3, backgroundColor: 'transparent' },
  railBody: {
    flex: 1,
    alignItems: 'center',
    gap: space.tight,
    paddingVertical: space.cosy,
    paddingHorizontal: space.snug,
  },
  railText: { ...type.caption, color: colors.subtle, textAlign: 'center' },
  railBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  railBadgeText: { ...type.caption, fontSize: 11 },

  grid: { flex: 1, gap: space.cosy },
  gridLabel: {
    ...type.label,
    color: colors.subtle,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  row: { flexDirection: 'row', gap: space.cosy, alignItems: 'stretch' },
  blank: { flex: 1 },
});
