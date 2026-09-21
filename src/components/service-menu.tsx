/**
 * The menu side of the till.
 *
 * A strip of categories to narrow by, and a grid of tiles big enough to hit
 * with a thumb while the other hand holds a bag. Every tile states its price,
 * so the menu is also the price list; a tile already on the ticket takes the
 * shop's own colour and wears what it carries, so the grid doubles as a
 * checklist on the way back down.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tileBadge } from '@/lib/domain/pos-ticket';
import { priceSubtitle } from '@/lib/domain/price-label';
import {
  CATEGORY_LABELS,
  labelledServices,
  type ServiceGroup,
} from '@/lib/domain/service-catalog';
import { serviceIcon } from '@/lib/domain/service-icon';
import { showcaseTitle, showcaseTone } from '@/lib/domain/service-showcase';
import { categoryIcon } from '@/lib/domain/shop-home';
import { gridRows } from '@/lib/domain/web-layout';
import type { ServiceRow } from '@/lib/types';

import { APP_TONE, type QuantityTone } from './quantity-picker';
import { RADII, colors, fontFor, space, type } from './ui-kit';

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

/**
 * One tile.
 *
 * A View holding two targets, not a button holding a button: the tile's own
 * press area fills it, and the key that takes a line back off floats above the
 * top-right corner. Nesting the second Pressable inside the first was invalid
 * on the web — a <button> inside a <button> — and the browser said so on every
 * chosen tile.
 */
function ServiceTile({
  service,
  categoryLabel,
  quantity,
  tone,
  onPress,
  onLess,
}: {
  service: ServiceRow;
  categoryLabel: string;
  quantity: number;
  tone: QuantityTone;
  onPress: () => void;
  /** Steps a counted tile down by one, or takes any other chosen tile off. */
  onLess: () => void;
}) {
  const badge = tileBadge(service, quantity);
  const isChosen = badge !== null;
  const field = showcaseTone(service.category);
  const hint =
    service.unit === 'per_kg'
      ? 'Opens the scale'
      : service.unit === 'flat'
        ? 'Adds it once'
        : 'Adds one more';

  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: field.field },
        isChosen && { borderColor: tone.brand },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isChosen ? `${service.name}, ${badge} on the ticket` : `Add ${service.name}`
        }
        accessibilityHint={hint}
        accessibilityState={{ selected: isChosen }}
        onPress={onPress}
        style={({ pressed }) => [styles.tileHit, pressed && styles.tilePressed]}
      >
        <View style={[styles.tag, { backgroundColor: colors.card }]}>
          <Text style={[styles.tagText, { color: field.ink }]} numberOfLines={1}>
            {categoryLabel}
          </Text>
        </View>
        <View style={[styles.tileIcon, isChosen && { backgroundColor: tone.brand }]}>
          <Ionicons
            name={serviceIcon(service.name, service.category) as never}
            size={20}
            color={isChosen ? colors.onAccent : field.ink}
          />
        </View>
        <Text style={[styles.tileName, { color: field.ink }]} numberOfLines={2}>
          {showcaseTitle(service.name)}
        </Text>
        <Text style={[styles.tilePrice, isChosen && { color: tone.ink }]} numberOfLines={1}>
          {priceSubtitle(service)}
        </Text>
      </Pressable>

      {badge ? (
        <View style={styles.badgeRow}>
          {/* The way back sits on the tile itself, so a mis-tap is undone
              where it happened rather than by clearing the whole ticket. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              service.unit === 'per_item'
                ? `One less ${service.name}`
                : `Take ${service.name} off the ticket`
            }
            onPress={onLess}
            hitSlop={space.snug}
            style={({ pressed }) => [
              styles.lessKey,
              { borderColor: tone.soft },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={service.unit === 'per_item' ? 'remove' : 'close'}
              size={16}
              color={tone.ink}
            />
          </Pressable>
          <View style={[styles.badge, { backgroundColor: tone.brand }]}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        </View>
      ) : null}
    </View>
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

  return (
    <View style={styles.menu}>
      {gridRows(tiles, 2).map((row, index) => (
        <View key={index} style={styles.row}>
          {row.map((entry, column) =>
            entry ? (
              <ServiceTile
                key={entry.service.id}
                service={entry.service}
                categoryLabel={entry.label}
                quantity={quantities[entry.service.id] ?? 0}
                tone={tone}
                onPress={() => onTap(entry.service)}
                onLess={() => onLess(entry.service)}
              />
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipText: { ...type.label, color: colors.text },
  chipTextActive: { color: colors.onAccent },

  menu: { gap: space.snug },
  row: { flexDirection: 'row', gap: space.snug, alignItems: 'stretch' },
  blank: { flex: 1 },

  /**
   * A tile, not a list row: the till is tapped from across a counter, so each
   * target is tall, and the price sits on the tile because a POS that hides
   * prices is a POS you have to trust.
   *
   * One grid, every service in it — the category lives in the card now, so
   * wash-and-fold sits beside ironing instead of above a heading and a blank.
   */
  tile: {
    flex: 1,
    minWidth: 0,
    minHeight: 132,
    borderRadius: RADII.card,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  /** The press area is the whole tile; the padding lives here so it is hit. */
  tileHit: { flex: 1, padding: space.cosy, paddingTop: space.room + 18, gap: space.tight },
  tag: {
    position: 'absolute',
    top: space.snug,
    left: space.snug,
    paddingHorizontal: space.snug,
    paddingVertical: 2,
    borderRadius: RADII.pill,
    maxWidth: '70%',
  },
  tagText: { ...type.caption, fontSize: 10.5, fontFamily: fontFor(700), letterSpacing: 0.3 },
  tilePressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: RADII.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionSurface,
  },
  tileIconChosen: { backgroundColor: colors.action },
  tileName: { ...type.body, fontWeight: '700', color: colors.text, marginTop: space.tight },
  tilePrice: { ...type.caption, fontSize: 13, color: colors.subtle },
  tilePriceChosen: { color: colors.actionInk },
  /** Floated over the tile's own corner rather than nested inside its button. */
  badgeRow: {
    position: 'absolute',
    top: space.cosy,
    right: space.cosy,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
  },
  lessKey: {
    width: 28,
    height: 28,
    borderRadius: RADII.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: colors.card,
  },
  /** What this tile has put on the ticket; white on the accent clears 4.5:1. */
  badge: {
    minHeight: 24,
    paddingHorizontal: space.snug,
    borderRadius: 999,
    justifyContent: 'center',
  },
  badgeText: { ...type.caption, fontWeight: '700', color: colors.onAccent },

  pressed: { opacity: 0.7 },
});
