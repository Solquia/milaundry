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
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PieceCounter, WeightScale, type QuantityTone } from '@/components/quantity-picker';
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
import { withAlpha } from '@/lib/domain/brand-gradient';
import { setLine, type Cart } from '@/lib/domain/web-cart';
import { useReducedMotion } from '@/lib/use-reduced-motion';
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
  // The ruler and the counters are the app's, wearing the shop's colour: on a
  // storefront the scale is the loudest thing on the page, and it should be
  // the shop that is loud.
  const tone: QuantityTone = { brand: theme.brand, soft: theme.brandSoft, ink: theme.brandInk };

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
              <RailTile
                isOpen={isOpen}
                theme={theme}
                label={CATEGORY_LABELS[entry.category]}
                held={held}
                onPress={() => {
                  setOpened(entry.category);
                  // The pick belongs to the category, so opening a new one
                  // starts clean rather than carrying the last answer over.
                  setPicked(null);
                }}
              >
                <ServiceScene
                  scene={sceneFor('', entry.category)}
                  brand={theme.brand}
                  surface="white"
                />
              </RailTile>

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
          <View style={[styles.measure, { shadowColor: theme.brand }]}>
            <View style={styles.measureHead}>
              <Text style={[styles.measureName, { color: theme.brandInk }]}>{service.name}</Text>
              {/* The rate, on its own ground. Loose under the name it read as a
                  second line of the title rather than as the price. */}
              <View style={[styles.measurePriceChip, { backgroundColor: theme.brandSoft }]}>
                <Text style={[styles.measurePrice, { color: theme.brandInk }]}>
                  {formatPriceLine(service)}
                </Text>
              </View>
            </View>

            {service.unit === 'per_kg' ? (
              <WeightScale
                valueKg={cart[service.id] ?? 0}
                onChange={(kg) => onChange(setLine(cart, service, kg))}
                tone={tone}
              />
            ) : (
              <PieceCounter
                value={cart[service.id] ?? 0}
                onChange={(count) => onChange(setLine(cart, service, count))}
                label={service.name}
                tone={tone}
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

/**
 * One category in the rail: a card that takes the shop's colour when it opens.
 *
 * It used to say so with a pale tint and a 3px edge down its left side, which
 * is the weakest signal a list can give — on a rail of four near-identical
 * white cards the open one has to be unmistakable from the corner of the eye,
 * because the panel beside it has already changed and the customer needs to
 * know which choice did that. So the open tile takes the accent outright, and
 * the illustration keeps its own white plate inside it so the drawing stays
 * the drawing rather than a silhouette on colour.
 */
function RailTile({
  isOpen,
  theme,
  label,
  held,
  onPress,
  children,
}: {
  isOpen: boolean;
  theme: StorefrontTheme;
  label: string;
  /** Lines from this category already on the ticket. */
  held: number;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const isReduced = useReducedMotion();
  const [press] = useState(() => new Animated.Value(1));

  const springTo = (toValue: number) => {
    if (isReduced) return;
    Animated.spring(press, {
      toValue,
      damping: 15,
      stiffness: 320,
      mass: 0.5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: isOpen, expanded: isOpen }}
        accessibilityLabel={held > 0 ? `${label}, ${held} in your basket` : label}
        onPressIn={() => springTo(0.96)}
        onPressOut={() => springTo(1)}
        onPress={onPress}
        style={[
          styles.railItem,
          isOpen && {
            backgroundColor: theme.brand,
            borderColor: theme.brand,
            shadowColor: theme.brand,
            ...styles.railItemOpen,
          },
        ]}
      >
        <View
          style={[
            styles.railPlate,
            { backgroundColor: isOpen ? '#FFFFFF' : withAlpha(theme.brand, 0.07) },
          ]}
        >
          <View style={styles.railArt}>{children}</View>
        </View>
        <Text
          numberOfLines={2}
          style={[styles.railText, isOpen && { color: theme.onBrand, ...styles.railTextOpen }]}
        >
          {label}
        </Text>
        {held > 0 ? (
          <View
            style={[
              styles.railBadge,
              { backgroundColor: isOpen ? theme.onBrand : theme.brand },
            ]}
          >
            <Text
              style={[
                styles.railBadgeText,
                { color: isOpen ? theme.brandInk : theme.onBrand },
              ]}
            >
              {held}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: { flexDirection: 'row', gap: space.cosy, alignItems: 'flex-start' },

  /** Narrow, because the panel beside it is where the work happens. */
  rail: { width: 116, flexGrow: 0, flexShrink: 0 },
  railInner: { gap: space.snug, paddingBottom: space.snug },
  railGroup: { gap: space.snug },
  railItem: {
    alignItems: 'center',
    gap: space.snug,
    paddingVertical: space.cosy,
    paddingHorizontal: space.snug,
    borderRadius: RADII.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  railItemOpen: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 5,
  },
  /** A plate under the drawing, so the object always sits on white. */
  railPlate: {
    width: 56,
    height: 56,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Square, so the scene's own 100-unit viewBox is never squashed. */
  railArt: { width: 40, height: 40 },
  railText: { ...type.caption, color: colors.subtle, textAlign: 'center' },
  railTextOpen: { fontFamily: type.label.fontFamily },
  railBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  railBadgeText: { ...type.caption, fontSize: 11, fontFamily: type.label.fontFamily },

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
  /**
   * The one surface on this step that is doing work, and it is lifted like it.
   * A 1px outline on white against a white rail made the two panes read as the
   * same plane, so the measure card looked like a wider rail item.
   */
  measure: {
    gap: space.room,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 22,
    elevation: 5,
  },
  measureHead: { gap: space.snug, alignItems: 'flex-start' },
  measureName: { ...type.section },
  measurePriceChip: {
    borderRadius: RADII.pill,
    paddingVertical: space.tight,
    paddingHorizontal: space.cosy,
  },
  measurePrice: { ...type.caption, fontFamily: type.label.fontFamily },
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
