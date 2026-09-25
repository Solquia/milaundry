/**
 * The menu side of the till.
 *
 * A strip of categories to narrow by, and a grid of tiles big enough to hit
 * with a thumb while the other hand holds a bag.
 *
 * The tiles used to be their own composition — a glyph in a rounded square, a
 * name, a price line — which meant the counter and the customer were looking
 * at two different drawings of the same service. They are shelf cards now, cut
 * to the till: a machine front with the category on its control strip, the
 * object behind a washer door, and the name above the rate. What the till keeps
 * for itself is everything about a running ticket — a chosen tile's light comes
 * on, its door fills with the shop's colour and tumbles with each tap, the
 * door's display says what is on the ticket, and the strip carries the key that
 * takes it back off.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { tileBadge } from '@/lib/domain/pos-ticket';
import { portholeLevel } from '@/lib/domain/porthole';
import {
  CATEGORY_LABELS,
  labelledServices,
  type ServiceGroup,
} from '@/lib/domain/service-catalog';
import { shelfPill } from '@/lib/domain/service-shelf';
import { showcasePrice, showcaseTitle, showcaseTone } from '@/lib/domain/service-showcase';
import { categoryIcon } from '@/lib/domain/shop-home';
import { gridRows } from '@/lib/domain/web-layout';
import type { ServiceRow } from '@/lib/types';

import { APP_TONE, type QuantityTone } from './quantity-picker';
import { ServicePorthole } from './service-porthole';
import { CROWN, RADII, colors, elevation, fontFor, space, type } from './ui-kit';

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
 * well. Nesting the second Pressable inside the first was invalid on the web —
 * a <button> inside a <button> — and the browser said so on every chosen tile.
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
  const price = showcasePrice(service);
  const pill = shelfPill(service);
  const hint =
    service.unit === 'per_kg'
      ? 'Opens the scale'
      : service.unit === 'flat'
        ? 'Adds it once'
        : 'Adds one more';

  return (
    <View style={[styles.tile, isChosen && { borderColor: tone.brand }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          isChosen
            ? `${showcaseTitle(service.name)}, ${badge} on the ticket`
            : `Add ${showcaseTitle(service.name)}`
        }
        accessibilityHint={hint}
        accessibilityState={{ selected: isChosen }}
        onPress={onPress}
        style={({ pressed }) => [styles.tileHit, pressed && styles.tilePressed]}
      >
        {/* The machine's control strip. Once the tile is on the ticket it
            takes the shop's colour and its light comes on, and its right end
            is where the way back lives. */}
        <View style={[styles.panel, isChosen && { backgroundColor: tone.soft }]}>
          <Text
            style={[styles.panelLabel, { color: isChosen ? tone.ink : field.ink }]}
            numberOfLines={1}
          >
            {categoryLabel}
          </Text>
          <View
            style={[styles.light, isChosen && { backgroundColor: tone.brand, borderColor: tone.brand }]}
          />
          {isChosen ? <View style={styles.lessRoom} /> : null}
        </View>

        {/* The same door the customer sees on the shopfront, cut smaller. The
            water rises as the ticket loads, in the shop's colour, and the
            door's display says what is on it. */}
        <View style={styles.door}>
          <ServicePorthole
            service={service}
            size={DOOR_SIZE}
            level={portholeLevel(service.unit, quantity)}
            waterTint={isChosen ? tone.brand : field.bg}
            tumbleKey={quantity}
            isSloshing={isChosen}
            readout={badge}
          />
        </View>

        <View style={styles.foot}>
          <Text style={styles.tileName} numberOfLines={2}>
            {showcaseTitle(service.name)}
          </Text>
          <Text style={styles.rateLine} numberOfLines={1}>
            <Text style={[styles.rate, { color: isChosen ? tone.ink : field.ink }]}>
              <Text style={styles.peso}>{price.symbol}</Text>
              {price.amount}
              {price.unit ? <Text style={styles.unit}>{price.unit}</Text> : null}
            </Text>
            {pill.kind === 'rule' ? <Text style={styles.rule}> · {pill.text}</Text> : null}
          </Text>
        </View>
      </Pressable>

      {isChosen ? (
        // The way back sits on the tile itself, so a mis-tap is undone where
        // it happened rather than by clearing the whole ticket. Floated over
        // the strip rather than nested in the tile's own button.
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
            { borderColor: tone.brand },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={service.unit === 'per_item' ? 'remove' : 'close'}
            size={15}
            color={tone.ink}
          />
        </Pressable>
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

/**
 * Smaller than the customer's door. The counter is tapping, not browsing: the
 * object is there to be recognised across a counter in a glance, and the height
 * it does not take is a row of the ticket that stays on screen.
 */
const DOOR_SIZE = 80;
/** The control strip's height, and the round key that takes a line back off. */
const PANEL_HEIGHT = 32;
const LESS_KEY = 26;

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
  blank: { flex: 1 },

  /**
   * A tile, not a list row: the till is tapped from across a counter, so each
   * target is tall, and the price sits on the tile because a POS that hides
   * prices is a POS you have to trust.
   *
   * One grid, every service in it — the category lives in the tile's own
   * corner, so wash-and-fold sits beside ironing instead of above a heading
   * and a blank.
   */
  tile: {
    flex: 1,
    minWidth: 0,
    ...CROWN,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    overflow: 'hidden',
    ...elevation.rest,
  },
  /** The press area is the whole tile; the well and the foot fill it. */
  tileHit: { flex: 1 },
  tilePressed: { opacity: 0.9 },


  /** The control strip: recessed a step from the white, a hairline under it. */
  panel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    height: PANEL_HEIGHT,
    paddingHorizontal: space.cosy,
    backgroundColor: colors.sunken,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  panelLabel: {
    flex: 1,
    ...type.caption,
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fontFor(800),
    letterSpacing: 0.2,
  },
  light: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.border,
  },
  /** Holds the strip's right end clear for the floated key. */
  lessRoom: { width: LESS_KEY - space.tight },

  door: { alignItems: 'center', paddingTop: space.cosy, paddingBottom: space.snug + 2 },

  foot: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: space.cosy,
    paddingBottom: space.cosy,
    gap: 2,
  },
  tileName: { ...type.label, fontFamily: fontFor(800), fontSize: 15, lineHeight: 19, color: colors.text },
  rateLine: { ...type.caption, fontSize: 13, lineHeight: 17 },
  rate: { fontFamily: fontFor(800), fontVariant: ['tabular-nums'] },
  peso: { fontFamily: fontFor(600), fontSize: 11.5 },
  unit: { fontFamily: fontFor(600), fontSize: 11.5 },
  rule: { fontFamily: fontFor(600), fontSize: 11.5, color: colors.subtle },

  /** Floated over the strip's right end rather than nested inside its button. */
  lessKey: {
    position: 'absolute',
    top: (PANEL_HEIGHT - LESS_KEY) / 2,
    right: space.tight + 2,
    width: LESS_KEY,
    height: LESS_KEY,
    borderRadius: LESS_KEY / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: colors.card,
  },

  pressed: { opacity: 0.7 },
});
