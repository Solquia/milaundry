/**
 * The ordering step: pick a category, pick the thing, then say how much.
 *
 * Three decisions in the order a customer actually makes them, and each one
 * stays where it was made. The rail on the left lists the categories; the one
 * you open unfolds its services underneath itself, so the choice happens where
 * you were already looking. The panel on the right is only ever the controls
 * for whatever is picked — the app's ruler for kilos, its row of counts for
 * pieces.
 *
 * The earlier version put a grid of cards on the right and made that pane do
 * both jobs: choosing and measuring. It meant the picture stayed on screen
 * competing with the stepper long after the choice was made, and a category of
 * one service showed a card with nothing to decide.
 *
 * A category holding a single service picks it outright, so opening Wash &
 * Fold puts the scale up in one tap. That rule and the fate of a stale pick
 * are `domain/service-rail.ts`.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PieceCounter, WeightScale } from '@/components/quantity-picker';
import { ServiceScene } from '@/components/service-scene';
import { RADII, colors, space, type } from '@/components/ui-kit';
import { formatPriceLine, minimumChargeNotice } from '@/lib/domain/price-label';
import {
  railLineCount,
  resolvePick,
  selectedRailCategory,
} from '@/lib/domain/service-rail';
import { CATEGORY_LABELS, groupServicesByCategory } from '@/lib/domain/service-catalog';
import { sceneFor } from '@/lib/domain/service-scene';
import { setLine, type Cart } from '@/lib/domain/web-cart';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontService } from '@/lib/types';

interface CartListProps {
  services: readonly StorefrontService[];
  cart: Cart;
  onChange: (next: Cart) => void;
  theme: StorefrontTheme;
}

export function CartList({ services, cart, onChange, theme }: CartListProps) {
  const groups = groupServicesByCategory(services);
  const [opened, setOpened] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  const current = selectedRailCategory(groups, opened);
  const group = groups.find((entry) => entry.category === current);
  const pickedId = resolvePick(group, picked);
  const service = group?.services.find((entry) => entry.id === pickedId);

  return (
    <View style={styles.frame}>
      <ScrollView
        style={styles.rail}
        contentContainerStyle={styles.railInner}
        showsVerticalScrollIndicator={false}
      >
        {groups.map((entry) => {
          const isOpen = entry.category === current;
          const held = railLineCount(cart, entry.services);
          return (
            <View key={entry.category} style={styles.railGroup}>
              <Pressable
                accessibilityRole="tab"
                accessibilityState={{ selected: isOpen, expanded: isOpen }}
                accessibilityLabel={
                  held > 0
                    ? `${CATEGORY_LABELS[entry.category]}, ${held} in your basket`
                    : CATEGORY_LABELS[entry.category]
                }
                onPress={() => {
                  setOpened(entry.category);
                  // The pick belongs to the category, so opening a new one
                  // starts clean rather than carrying the last answer over.
                  setPicked(null);
                }}
                style={[styles.railItem, isOpen && { backgroundColor: theme.brandSoft }]}
              >
                <View style={[styles.railEdge, isOpen && { backgroundColor: theme.brand }]} />
                <View style={styles.railBody}>
                  <View style={styles.railArt}>
                    <ServiceScene
                      scene={sceneFor('', entry.category)}
                      brand={theme.brand}
                      surface="white"
                    />
                  </View>
                  <Text
                    numberOfLines={2}
                    style={[styles.railText, isOpen && { color: theme.brandInk }]}
                  >
                    {CATEGORY_LABELS[entry.category]}
                  </Text>
                  {held > 0 ? (
                    <View style={[styles.railBadge, { backgroundColor: theme.brand }]}>
                      <Text style={[styles.railBadgeText, { color: theme.onBrand }]}>
                        {held}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>

              {/* The choices, under the category they belong to. A category of
                  one has nothing to choose, so it never unfolds a list of one. */}
              {isOpen && entry.services.length > 1 ? (
                <View style={styles.choices}>
                  {entry.services.map((option) => {
                    const isPicked = option.id === pickedId;
                    const inBasket = (cart[option.id] ?? 0) > 0;
                    return (
                      <Pressable
                        key={option.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isPicked }}
                        accessibilityLabel={`${option.name}, ${formatPriceLine(option)}`}
                        onPress={() => setPicked(option.id)}
                        style={[
                          styles.choice,
                          isPicked && {
                            backgroundColor: theme.brandSoft,
                            borderColor: theme.brand,
                          },
                        ]}
                      >
                        <View style={styles.choiceArt}>
                          <ServiceScene
                            scene={sceneFor(option.name, option.category)}
                            brand={theme.brand}
                            surface="white"
                          />
                        </View>
                        <Text numberOfLines={2} style={styles.choiceName}>
                          {option.name}
                        </Text>
                        {/* A line already on the ticket says so here, where the
                            customer is choosing, not only in the panel. */}
                        {inBasket ? (
                          <View style={[styles.choiceDot, { backgroundColor: theme.brand }]} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.panel}>
        {service ? (
          <View style={styles.measure}>
            <View style={styles.measureHead}>
              <Text style={[styles.measureName, { color: theme.brandInk }]}>
                {service.name}
              </Text>
              <Text style={styles.measurePrice}>{formatPriceLine(service)}</Text>
            </View>

            {service.unit === 'per_kg' ? (
              <WeightScale
                valueKg={cart[service.id] ?? 0}
                onChange={(kg) => onChange(setLine(cart, service, kg))}
              />
            ) : (
              <PieceCounter
                value={cart[service.id] ?? 0}
                onChange={(count) => onChange(setLine(cart, service, count))}
                label={service.name}
              />
            )}

            {minimumChargeNotice(service, cart[service.id] ?? 0) ? (
              <Text style={styles.measureNotice}>
                {minimumChargeNotice(service, cart[service.id] ?? 0)}
              </Text>
            ) : null}
          </View>
        ) : (
          // Not an error, and not empty: the panel says what it is waiting for.
          <View style={styles.waiting}>
            <Text style={styles.waitingText}>
              {group
                ? `Pick what you are having ${CATEGORY_LABELS[group.category].toLowerCase()} to set the amount.`
                : 'This shop has no prices listed yet.'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flexDirection: 'row', gap: space.cosy, alignItems: 'flex-start' },

  /** Narrow, because the panel beside it is where the work happens. */
  rail: { width: 116, flexGrow: 0, flexShrink: 0 },
  railInner: { gap: space.snug, paddingBottom: space.snug },
  railGroup: { gap: space.snug },
  railItem: {
    flexDirection: 'row',
    borderRadius: RADII.chip,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  /** 3px lit edge — the rail marks the open door without shouting. */
  railEdge: { width: 3, backgroundColor: 'transparent' },
  railBody: {
    flex: 1,
    alignItems: 'center',
    gap: space.tight,
    paddingVertical: space.cosy,
    paddingHorizontal: space.snug,
  },
  /** Square, so the scene's own 100-unit viewBox is never squashed. */
  railArt: { width: 44, height: 44 },
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

  /** Indented, so the list reads as belonging to the category above it. */
  choices: { gap: space.snug, paddingLeft: space.cosy },
  choice: {
    alignItems: 'center',
    gap: space.tight,
    paddingVertical: space.snug,
    paddingHorizontal: space.tight,
    borderRadius: RADII.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  choiceArt: { width: 40, height: 40 },
  choiceName: { ...type.caption, color: colors.text, textAlign: 'center' },
  /** Already on the ticket. Said where the choosing happens, not only after. */
  choiceDot: { width: 6, height: 6, borderRadius: 3 },

  panel: { flex: 1 },
  measure: {
    gap: space.cosy,
    padding: space.room,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  measureHead: { gap: space.tight },
  measureName: { ...type.section },
  measurePrice: { ...type.body, color: colors.subtle },
  measureNotice: { ...type.caption, color: colors.moneyOut },

  waiting: {
    padding: space.room,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
  },
  waitingText: { ...type.body, color: colors.subtle },
});
