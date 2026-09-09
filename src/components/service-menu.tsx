/**
 * The menu side of the till.
 *
 * A strip of categories to narrow by, and a grid of tiles big enough to hit
 * with a thumb while the other hand holds a bag. Every tile states its price,
 * so the menu is also the price list; a tile already on the ticket turns blue
 * and wears what it carries, so the grid doubles as a checklist on the way
 * back down.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tileBadge } from '@/lib/domain/pos-ticket';
import { priceSubtitle } from '@/lib/domain/price-label';
import { CATEGORY_LABELS, type ServiceGroup } from '@/lib/domain/service-catalog';
import { serviceIcon } from '@/lib/domain/service-icon';
import { categoryIcon } from '@/lib/domain/shop-home';
import type { ServiceRow } from '@/lib/types';

import { RADII, colors, space, type } from './ui-kit';

export const ALL_CATEGORIES = 'all';

/** Tiles two to a row; an odd last tile keeps its width with a blank beside it. */
function pairs<T>(items: readonly T[]): (T | null)[][] {
  const rows: (T | null)[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push([items[i], items[i + 1] ?? null]);
  }
  return rows;
}

export function CategoryStrip({
  groups,
  active,
  onChange,
}: {
  groups: ServiceGroup<ServiceRow>[];
  active: string;
  onChange: (category: string) => void;
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
              isActive && styles.chipActive,
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

function ServiceTile({
  service,
  quantity,
  onPress,
  onLess,
}: {
  service: ServiceRow;
  quantity: number;
  onPress: () => void;
  /** Steps a counted tile down by one, or takes any other chosen tile off. */
  onLess: () => void;
}) {
  const badge = tileBadge(service, quantity);
  const isChosen = badge !== null;
  const hint =
    service.unit === 'per_kg'
      ? 'Opens the scale'
      : service.unit === 'flat'
        ? 'Adds it once'
        : 'Adds one more';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isChosen ? `${service.name}, ${badge} on the ticket` : `Add ${service.name}`
      }
      accessibilityHint={hint}
      accessibilityState={{ selected: isChosen }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        isChosen && styles.tileChosen,
        pressed && styles.tilePressed,
      ]}
    >
      <View style={styles.tileTop}>
        <View style={[styles.tileIcon, isChosen && styles.tileIconChosen]}>
          <Ionicons
            name={serviceIcon(service.name, service.category) as never}
            size={20}
            color={isChosen ? colors.onAccent : colors.actionInk}
          />
        </View>
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
              style={({ pressed }) => [styles.lessKey, pressed && styles.pressed]}
            >
              <Ionicons
                name={service.unit === 'per_item' ? 'remove' : 'close'}
                size={16}
                color={colors.actionInk}
              />
            </Pressable>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          </View>
        ) : null}
      </View>
      <Text style={styles.tileName} numberOfLines={2}>
        {service.name}
      </Text>
      <Text style={[styles.tilePrice, isChosen && styles.tilePriceChosen]} numberOfLines={1}>
        {priceSubtitle(service)}
      </Text>
    </Pressable>
  );
}

export function ServiceMenu({
  groups,
  active,
  quantities,
  onTap,
  onLess,
}: {
  groups: ServiceGroup<ServiceRow>[];
  active: string;
  quantities: Readonly<Record<string, number>>;
  onTap: (service: ServiceRow) => void;
  onLess: (service: ServiceRow) => void;
}) {
  const shown =
    active === ALL_CATEGORIES ? groups : groups.filter((group) => group.category === active);
  const showHeadings = active === ALL_CATEGORIES && groups.length > 1;

  return (
    <View style={styles.menu}>
      {shown.map((group) => (
        <View key={group.category} style={styles.section}>
          {showHeadings ? (
            <Text style={styles.sectionLabel}>{CATEGORY_LABELS[group.category]}</Text>
          ) : null}
          {pairs(group.services).map((row, index) => (
            <View key={index} style={styles.row}>
              {row.map((service, column) =>
                service ? (
                  <ServiceTile
                    key={service.id}
                    service={service}
                    quantity={quantities[service.id] ?? 0}
                    onPress={() => onTap(service)}
                    onLess={() => onLess(service)}
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
  chipActive: { backgroundColor: colors.action, borderColor: colors.action },
  chipText: { ...type.label, color: colors.text },
  chipTextActive: { color: colors.onAccent },

  menu: { gap: space.section },
  section: { gap: space.cosy },
  sectionLabel: { ...type.label, color: colors.subtle, letterSpacing: 0.3 },
  row: { flexDirection: 'row', gap: space.cosy },
  blank: { flex: 1 },

  /**
   * A tile, not a list row: the till is tapped from across a counter, so each
   * target is tall, and the price sits on the tile because a POS that hides
   * prices is a POS you have to trust.
   */
  tile: {
    flex: 1,
    minHeight: 118,
    padding: space.cosy,
    gap: space.tight,
    borderRadius: RADII.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tileChosen: { borderColor: colors.action, backgroundColor: colors.actionSurface },
  tilePressed: { transform: [{ scale: 0.97 }], opacity: 0.9 },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
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
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: space.tight },
  lessKey: {
    width: 28,
    height: 28,
    borderRadius: RADII.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.actionMuted,
    backgroundColor: colors.card,
  },
  /** What this tile has put on the ticket; white on `action` clears 5.9:1. */
  badge: {
    minHeight: 24,
    paddingHorizontal: space.snug,
    borderRadius: 999,
    justifyContent: 'center',
    backgroundColor: colors.action,
  },
  badgeText: { ...type.caption, fontWeight: '700', color: colors.onAccent },

  pressed: { opacity: 0.7 },
});
