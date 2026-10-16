/**
 * The spotlight's services: round category pictures to jump between, then a
 * grid of product cards — a clean shot of the work on a tinted well, the
 * name, the price and a "+" — the way McDonald's lays out its burgers.
 *
 * Presentational; the basket rules are `domain/market-cart` and what each
 * card says is `domain/spotlight`. A tap on a card opens its sheet; a tap on
 * its "+" adds without leaving the grid.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { GLASS_EDGE, GLASS_FILL_DENSE, glassPane, useIsGlass } from './glass';
import { ServicePhoto } from './service-photo';
import { ACCENTS, RADII, colors, elevation, space, type } from './ui-kit';
import { isLoad, type Cart } from '@/lib/domain/market-cart';
import type { ServiceCategory } from '@/lib/domain/service-catalog';
import { showcaseBlurb, showcaseTitle } from '@/lib/domain/service-showcase';
import {
  cardTag,
  spotlightPrice,
  type ServiceFrame,
  type SpotlightSection,
  type SpotlightService,
} from '@/lib/domain/spotlight';
import { gridRows } from '@/lib/domain/web-layout';
import { fontFor } from '@/lib/domain/design-scale';

type Accent = (typeof ACCENTS)[number];

export const ALL = 'all' as const;
export type ServiceFilter = ServiceCategory | typeof ALL;

// ── the add control ───────────────────────────────────────────────────────

interface AddControlProps {
  service: SpotlightService;
  quantity: number;
  accent: Accent;
  onAdd: () => void;
  onRemove: () => void;
  /** The larger control, for the sheet. */
  isLarge?: boolean;
}

/** A "+" until the service is in the basket, then − count +; a load stops at one. */
export function AddControl({ service, quantity, accent, onAdd, onRemove, isLarge = false }: AddControlProps) {
  const size = isLarge ? 46 : 34;
  const isALoad = isLoad(service);
  if (quantity <= 0) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Add ${service.name} to basket`}
        onPress={onAdd}
        hitSlop={8}
        style={({ pressed }) => [
          controls.plus,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: accent.ink },
          pressed && controls.pressed,
        ]}
      >
        <Ionicons name="add" size={isLarge ? 26 : 21} color={colors.onAccent} />
      </Pressable>
    );
  }
  return (
    <View style={[controls.stepper, { height: size, backgroundColor: accent.ink }]}>
      <Step icon="remove" label={`Remove one ${service.name}`} size={size} onPress={onRemove} />
      {isALoad ? (
        <Ionicons name="checkmark" size={isLarge ? 20 : 16} color={colors.onAccent} />
      ) : (
        <Text style={[controls.count, isLarge && controls.countLarge]}>{quantity}</Text>
      )}
      {isALoad ? null : <Step icon="add" label={`Add one more ${service.name}`} size={size} onPress={onAdd} />}
    </View>
  );
}

function Step({
  icon,
  label,
  size,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  size: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [controls.step, { width: size - 6, height: size }, pressed && controls.pressed]}
    >
      <Ionicons name={icon} size={size > 40 ? 22 : 17} color={colors.onAccent} />
    </Pressable>
  );
}

// ── category circles ──────────────────────────────────────────────────────

interface CategoryCirclesProps {
  sections: readonly SpotlightSection<SpotlightService>[];
  filter: ServiceFilter;
  accent: Accent;
  onChoose: (filter: ServiceFilter) => void;
}

/** Round pictures in a row, "All" first; the chosen one sits in a ring of the shop's colour. */
export function CategoryCircles({ sections, filter, accent, onChoose }: CategoryCirclesProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={circles.row}
      accessibilityRole="tablist"
    >
      <Circle label="All" isOn={filter === ALL} accent={accent} onPress={() => onChoose(ALL)}>
        <View style={[circles.face, circles.allFace, { backgroundColor: accent.surface }]}>
          <Ionicons name="apps" size={24} color={accent.ink} />
        </View>
      </Circle>
      {sections.map((section) => (
        <Circle
          key={section.category}
          label={section.short}
          isOn={filter === section.category}
          accent={accent}
          onPress={() => onChoose(section.category)}
        >
          <ServicePhoto photo={section.photo} style={[circles.face, { backgroundColor: accent.surface }]} />
        </Circle>
      ))}
    </ScrollView>
  );
}

function Circle({
  label,
  isOn,
  accent,
  onPress,
  children,
}: {
  label: string;
  isOn: boolean;
  accent: Accent;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: isOn }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [circles.item, pressed && controls.pressed]}
    >
      <View style={[circles.ring, isOn && { borderColor: accent.ink, backgroundColor: colors.card }]}>{children}</View>
      <Text style={[circles.label, isOn && [circles.labelOn, { color: accent.ink }]]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── one product card ──────────────────────────────────────────────────────

export interface ProductCardProps {
  service: SpotlightService;
  frame: ServiceFrame | undefined;
  lowestId: string | null;
  quantity: number;
  accent: Accent;
  isDisabled: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onRemove: () => void;
  /** A fixed width for a rail; a grid cell stretches instead. */
  width?: number;
}

export function ProductCard({
  service,
  frame,
  lowestId,
  quantity,
  accent,
  isDisabled,
  onOpen,
  onAdd,
  onRemove,
  width,
}: ProductCardProps) {
  const { figure, unit } = spotlightPrice(service);
  const tag = cardTag(service, lowestId);
  const isLowest = service.id === lowestId;
  const inBasket = quantity > 0;
  const isGlass = useIsGlass();
  // The card and its add control are siblings: an accessible Pressable folds
  // everything inside it into one node, which would hide "Remove one".
  return (
    <View
      style={[
        card.card,
        isGlass ? card.cardGlass : elevation.rest,
        width !== undefined ? { width } : card.stretch,
        inBasket && { borderColor: accent.ink },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${service.name}, ${figure}${unit}${inBasket ? ', in basket' : ''}`}
        accessibilityHint="Shows the details"
        onPress={onOpen}
        style={({ pressed }) => [card.tap, pressed && card.pressed]}
      >
        <View>
          {frame ? (
            <ServicePhoto photo={frame.photo} uri={frame.imageUrl} style={[card.well, { backgroundColor: accent.surface }]} />
          ) : (
            <View style={[card.well, { backgroundColor: accent.surface }]} />
          )}
          <View style={[card.tag, isLowest ? { backgroundColor: accent.ink } : card.tagPlain]}>
            {isLowest ? <Ionicons name="pricetag" size={10} color={colors.onAccent} /> : null}
            <Text style={[card.tagText, { color: isLowest ? colors.onAccent : accent.ink }]}>{tag}</Text>
          </View>
        </View>
        <View style={card.words}>
          <Text style={card.name} numberOfLines={2}>
            {showcaseTitle(service.name)}
          </Text>
          <Text style={card.blurb} numberOfLines={1}>
            {showcaseBlurb(service)}
          </Text>
          <Text style={card.price} numberOfLines={1}>
            {figure}
            <Text style={card.unit}>{unit}</Text>
          </Text>
        </View>
      </Pressable>
      {isDisabled ? null : (
        <View style={card.add}>
          <AddControl service={service} quantity={quantity} accent={accent} onAdd={onAdd} onRemove={onRemove} />
        </View>
      )}
    </View>
  );
}

// ── the grid ──────────────────────────────────────────────────────────────

interface ServiceGridProps<T extends SpotlightService> {
  sections: readonly SpotlightSection<T>[];
  frames: ReadonlyMap<string, ServiceFrame>;
  lowestId: string | null;
  cart: Cart;
  accent: Accent;
  isDisabled: boolean;
  onOpen: (service: T) => void;
  onAdd: (service: T) => void;
  onRemove: (serviceId: string) => void;
}

/** Two cards to a phone row, more as the window widens. */
function columnsFor(width: number): number {
  if (width >= 900) return 4;
  if (width >= 600) return 3;
  return 2;
}

export function ServiceGrid<T extends SpotlightService>({
  sections,
  frames,
  lowestId,
  cart,
  accent,
  isDisabled,
  onOpen,
  onAdd,
  onRemove,
}: ServiceGridProps<T>) {
  const [width, setWidth] = useState(0);
  const columns = columnsFor(width);
  const isGlass = useIsGlass();
  return (
    <View style={grid.wrap} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {sections.map((section) => (
        <View key={section.category} style={grid.section}>
          <View style={grid.head}>
            <Text style={grid.title} accessibilityRole="header">
              {section.title}
            </Text>
            <Text style={[grid.meta, isGlass && grid.metaGlass]}>{section.services.length}</Text>
          </View>
          {gridRows(section.services, columns).map((row, rowIndex) => (
            <View key={rowIndex} style={grid.row}>
              {row.map((service, column) => (
                <View key={service ? service.id : `blank-${column}`} style={grid.cell}>
                  {service ? (
                    <ProductCard
                      service={service}
                      frame={frames.get(service.id)}
                      lowestId={lowestId}
                      quantity={cart[service.id] ?? 0}
                      accent={accent}
                      isDisabled={isDisabled}
                      onOpen={() => onOpen(service)}
                      onAdd={() => onAdd(service)}
                      onRemove={() => onRemove(service.id)}
                    />
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const controls = StyleSheet.create({
  plus: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: RADII.pill, paddingHorizontal: 3 },
  step: { alignItems: 'center', justifyContent: 'center' },
  count: { ...type.label, color: colors.onAccent, minWidth: 16, textAlign: 'center' },
  countLarge: { fontSize: 18, minWidth: 28 },
});

const circles = StyleSheet.create({
  row: { gap: space.snug, paddingVertical: 2, paddingRight: space.room },
  item: { alignItems: 'center', width: 74, gap: space.tight + 2 },
  ring: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2.5,
    borderColor: 'transparent',
    padding: 3,
  },
  face: { flex: 1, borderRadius: 30 },
  allFace: { alignItems: 'center', justifyContent: 'center' },
  label: { ...type.caption, fontSize: 12, color: colors.subtle, textAlign: 'center' },
  labelOn: { ...fontFor(700) },
});

const WELL = 124;

const card = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: RADII.card - 2,
    borderCurve: 'continuous',
    borderWidth: 1.5,
    borderColor: 'transparent',
    padding: space.snug,
    ...elevation.rest,
  },
  cardGlass: { ...glassPane, borderWidth: 1.5, borderRadius: RADII.card - 2 },
  stretch: { flex: 1 },
  tap: { flex: 1 },
  pressed: { opacity: 0.92 },
  well: { height: WELL, borderRadius: RADII.control, borderCurve: 'continuous' },
  tag: {
    position: 'absolute',
    top: space.snug,
    left: space.snug,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADII.pill,
  },
  tagPlain: { backgroundColor: 'rgba(255,255,255,0.92)' },
  tagText: { ...type.caption, fontSize: 11, lineHeight: 14, ...fontFor(600) },
  words: { paddingTop: space.snug, paddingHorizontal: 2, gap: 2, flex: 1 },
  name: { ...type.label, fontSize: 15, lineHeight: 19, color: colors.text, minHeight: 38 },
  blurb: { ...type.caption, fontSize: 12, lineHeight: 16, color: colors.subtle, paddingRight: 40 },
  price: { ...type.label, fontSize: 17, color: colors.text, marginTop: 'auto', paddingTop: space.tight, paddingRight: 44 },
  unit: { ...type.caption, fontSize: 12, color: colors.subtle },
  add: { position: 'absolute', right: space.snug, bottom: space.snug },
});

const grid = StyleSheet.create({
  wrap: { gap: space.section },
  section: { gap: space.snug + 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  title: { ...type.section, fontSize: 20, lineHeight: 25, color: colors.text },
  meta: {
    ...type.caption,
    fontSize: 12,
    ...fontFor(600),
    color: colors.subtle,
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
    borderRadius: RADII.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  // A Text, so the chip's fill and edge rather than the View-typed glassChip.
  metaGlass: { backgroundColor: GLASS_FILL_DENSE, borderWidth: 1, borderColor: GLASS_EDGE },
  row: { flexDirection: 'row', gap: space.cosy - 2 },
  cell: { flex: 1 },
});
