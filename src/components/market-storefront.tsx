/**
 * The market storefront: a shop's price list as an online store.
 *
 * The look customers already shop in — Shopee's product grid, foodpanda's
 * category chips and a "+" on every card, Grab's compact store header with
 * the rating and the ways to get your order. A shop switches to it from
 * Settings (`storefront-style`); the classic shopfront stays the default.
 *
 * Presentational only, and shared: the app's shop screen and the shop's web
 * page both draw it, and both hold the basket and say where checkout goes.
 * The basket itself — what "+" does to a load, how a count is capped — is
 * `domain/market-cart`, so the grid only reports taps.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SearchField } from './search-field';
import { ServiceScene } from './service-scene';
import { ShopLogo } from './shop-logo';
import { ShopStatusPill } from './shop-status-pill';
import { ACCENTS, RADII, colors, elevation, formatMoney, space, type } from './ui-kit';
import { formatMoneyCompact } from '@/lib/domain/money';
import { isLoad, type Cart, type CartService } from '@/lib/domain/market-cart';
import { capacityLabel, minimumLabel, unitSuffix } from '@/lib/domain/price-label';
import {
  CATEGORY_ORDER,
  CATEGORY_SHORT,
  groupServicesByCategory,
  labelledServices,
  type ServiceCategory,
} from '@/lib/domain/service-catalog';
import { serviceLooks, type ServiceLook } from '@/lib/domain/service-look';
import { filterShelf } from '@/lib/domain/service-shelf';
import { showcaseTone } from '@/lib/domain/service-showcase';
import type { ShopStatus } from '@/lib/domain/shop-availability';
import type { Reputation } from '@/lib/domain/storefront';
import { gridRows } from '@/lib/domain/web-layout';

type Accent = (typeof ACCENTS)[number];

export type MarketService = CartService & { description?: string | null };

// ── the store header ──────────────────────────────────────────────────────

interface MarketHeaderProps {
  name: string;
  tagline: string;
  logoUrl: string | null;
  accent: Accent;
  reputation: Reputation | null;
  sign: ShopStatus | null;
  /** The cheapest price on the list, for the "from" chip. */
  cheapest: number | null;
  /** The shop's own photo across the top, the way a store page opens; '' for none. */
  coverUrl?: string | null;
  insetTop?: number;
  onBack?: () => void;
  /** A Connect button, or nothing once the customer is connected. */
  action?: React.ReactNode;
  /**
   * Inside a padded screen the band bleeds past the padding to the display's
   * edges (the app). In a page's full-width hero slot it already reaches them,
   * and the card is inset instead (the web).
   */
  isInset?: boolean;
}

export function MarketHeader({
  name,
  tagline,
  logoUrl,
  accent,
  reputation,
  sign,
  cheapest,
  coverUrl,
  insetTop = 0,
  onBack,
  action,
  isInset = false,
}: MarketHeaderProps) {
  return (
    <View>
      <View
        style={[
          header.band,
          !isInset && header.bleed,
          { backgroundColor: accent.ink, paddingTop: insetTop + space.snug },
        ]}
      >
        {coverUrl ? (
          <>
            <Image source={{ uri: coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
            {/* A wash of the shop's colour, so the back button reads on any photo. */}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: accent.ink, opacity: 0.35 }]} />
          </>
        ) : null}
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={onBack}
            hitSlop={8}
            style={({ pressed }) => [header.back, pressed && header.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      <View style={[header.card, isInset && header.cardInset, elevation.rest]}>
        <View style={header.top}>
          <ShopLogo name={name} logoUrl={logoUrl} size={60} accent={accent} shape="plate" />
          <View style={header.words}>
            <Text style={header.name} numberOfLines={2} accessibilityRole="header">
              {name}
            </Text>
            {tagline ? (
              <Text style={header.tagline} numberOfLines={1}>
                {tagline}
              </Text>
            ) : null}
            <View style={header.meta}>
              {reputation ? (
                <View style={header.rating}>
                  <Ionicons name="star" size={13} color="#E0A100" />
                  <Text style={header.ratingText}>{reputation.label}</Text>
                </View>
              ) : null}
              {sign ? <ShopStatusPill status={sign} showDetail={false} /> : null}
            </View>
          </View>
        </View>
        <View style={header.chips}>
          <InfoChip icon="bicycle-outline" label="Delivery" />
          <InfoChip icon="storefront-outline" label="Drop-off" />
          {cheapest !== null ? <InfoChip icon="pricetag-outline" label={`From ${formatMoneyCompact(cheapest)}`} /> : null}
        </View>
        {action}
      </View>
    </View>
  );
}

function InfoChip({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={header.chip}>
      <Ionicons name={icon} size={14} color={colors.subtle} />
      <Text style={header.chipText}>{label}</Text>
    </View>
  );
}

// ── the catalog ───────────────────────────────────────────────────────────

interface MarketCatalogProps<T extends MarketService> {
  services: readonly T[];
  cart: Cart;
  accent: Accent;
  onAdd: (service: T) => void;
  onRemove: (serviceId: string) => void;
  /** Shown but not addable: the app before the customer has connected. */
  isDisabled?: boolean;
  /** A line over the grid: "Swapped Wash & Fold for Wash-Dry". */
  notice?: string | null;
}

const ALL = 'all' as const;
type Filter = ServiceCategory | typeof ALL;

/** Two cards to a phone row, more as the window widens. */
function columnsFor(width: number): number {
  if (width >= 900) return 4;
  if (width >= 600) return 3;
  return 2;
}

export function MarketCatalog<T extends MarketService>({
  services,
  cart,
  accent,
  onAdd,
  onRemove,
  isDisabled = false,
  notice,
}: MarketCatalogProps<T>) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>(ALL);
  const [width, setWidth] = useState(0);

  const entries = useMemo(() => labelledServices(groupServicesByCategory(services)), [services]);
  const looks = useMemo(() => serviceLooks(services), [services]);
  const categories = CATEGORY_ORDER.filter((key) => services.some((service) => service.category === key));
  const shown = filterShelf(entries, query).filter(
    (entry) => filter === ALL || entry.service.category === filter
  );

  return (
    <View style={catalog.wrap}>
      <SearchField
        value={query}
        onChangeText={setQuery}
        placeholder="Search"
        accessibilityLabel="Search this shop's services"
      />
      {categories.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={catalog.chips}
          accessibilityRole="tablist"
        >
          {[ALL, ...categories].map((key) => {
            const isOn = key === filter;
            return (
              <Pressable
                key={key}
                accessibilityRole="tab"
                accessibilityState={{ selected: isOn }}
                onPress={() => setFilter(key)}
                style={[catalog.chip, isOn && { backgroundColor: accent.ink, borderColor: accent.ink }]}
              >
                <Text style={[catalog.chipText, isOn && { color: colors.onAccent }]}>
                  {key === ALL ? 'All' : CATEGORY_SHORT[key]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {notice ? (
        <View style={[catalog.notice, { backgroundColor: accent.surface }]} accessibilityLiveRegion="polite">
          <Ionicons name="swap-horizontal" size={16} color={accent.ink} />
          <Text style={[catalog.noticeText, { color: accent.ink }]}>{notice}</Text>
        </View>
      ) : null}
      {isDisabled ? (
        <Text style={catalog.disabled}>Connect to order</Text>
      ) : null}

      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={catalog.grid}>
        {gridRows(shown, columnsFor(width)).map((row, rowIndex) => (
          <View key={rowIndex} style={catalog.row}>
            {row.map((entry, column) => (
              <View key={entry ? entry.service.id : `blank-${column}`} style={catalog.cell}>
                {entry ? (
                  <ProductCard
                    service={entry.service}
                    label={entry.label}
                    look={looks.get(entry.service.id)}
                    quantity={cart[entry.service.id] ?? 0}
                    accent={accent}
                    isDisabled={isDisabled}
                    onAdd={() => onAdd(entry.service)}
                    onRemove={() => onRemove(entry.service.id)}
                  />
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </View>
      {shown.length === 0 ? (
        <Text style={catalog.empty}>
          {services.length === 0
            ? 'No services yet'
            : 'No match'}
        </Text>
      ) : null}
    </View>
  );
}

// ── one product ───────────────────────────────────────────────────────────

interface ProductCardProps {
  service: MarketService;
  label: string;
  look: ServiceLook | undefined;
  quantity: number;
  accent: Accent;
  isDisabled: boolean;
  onAdd: () => void;
  onRemove: () => void;
}

function ProductCard({ service, label, look, quantity, accent, isDisabled, onAdd, onRemove }: ProductCardProps) {
  const tone = showcaseTone(service.category);
  const isALoad = isLoad(service);
  const facts = minimumLabel(service) ?? '';
  const suffix = service.unit === 'flat' && capacityLabel(service) ? '/load' : unitSuffix(service.unit);
  const isInBasket = quantity > 0;
  const price = `${formatMoney(service.price)}${suffix}`;

  // The card and its stepper are siblings, not parent and child: an accessible
  // Pressable folds everything inside it into one node, which would leave a
  // screen reader unable to reach "Remove one".
  return (
    <View style={[card.card, elevation.rest, isInBasket && { borderColor: accent.ink }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${service.name}, ${price}${isInBasket ? ', in basket' : ''}`}
        accessibilityHint={isDisabled || (isALoad && isInBasket) ? undefined : 'Adds it to your basket'}
        accessibilityState={{ disabled: isDisabled }}
        disabled={isDisabled}
        onPress={onAdd}
        style={({ pressed }) => [card.tap, pressed && card.pressed]}
      >
        <View style={[card.art, { backgroundColor: tone.field }]}>
          {look ? <ServiceScene scene={look.scene} colorway={look.colorway} brand={tone.bg} surface="white" /> : null}
          <View style={[card.badge, { backgroundColor: tone.bg }]}>
            <Text style={card.badgeText}>{label}</Text>
          </View>
        </View>
        <View style={card.words}>
          <Text style={card.name} numberOfLines={2}>
            {service.name}
          </Text>
          {facts ? (
            <Text style={card.facts} numberOfLines={1}>
              {facts}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <View style={card.body}>
        <View style={card.foot}>
          <Text style={[card.price, { color: accent.ink }]} numberOfLines={1}>
            {formatMoneyCompact(service.price)}
            <Text style={card.unit}>{suffix}</Text>
          </Text>
          {isDisabled ? null : isInBasket ? (
            <View style={[card.stepper, { backgroundColor: accent.surface }]}>
              <StepButton icon="remove" label={`Remove one ${service.name}`} color={accent.ink} onPress={onRemove} />
              {isALoad ? (
                <Ionicons name="checkmark" size={16} color={accent.ink} />
              ) : (
                <Text style={[card.count, { color: accent.ink }]}>{quantity}</Text>
              )}
              {isALoad ? null : (
                <StepButton icon="add" label={`Add one more ${service.name}`} color={accent.ink} onPress={onAdd} />
              )}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Add ${service.name} to basket`}
              onPress={onAdd}
              hitSlop={8}
              style={({ pressed }) => [card.plus, { backgroundColor: accent.ink }, pressed && card.pressed]}
            >
              <Ionicons name="add" size={20} color={colors.onAccent} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

function StepButton({
  icon,
  label,
  color,
  onPress,
}: {
  icon: 'add' | 'remove';
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={card.step}>
      <Ionicons name={icon} size={18} color={color} />
    </Pressable>
  );
}

const header = StyleSheet.create({
  // Bleeds past the screen's own padding to the display's edges, as the
  // classic hero does, so the band reads as the top of the store.
  band: { minHeight: 132, paddingHorizontal: space.room, overflow: 'hidden' },
  bleed: { marginHorizontal: -space.room, marginTop: -space.room },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  card: {
    marginTop: -36,
    backgroundColor: colors.card,
    borderRadius: RADII.card,
    padding: space.room,
    gap: space.cosy,
  },
  cardInset: { marginHorizontal: space.room },
  top: { flexDirection: 'row', gap: space.cosy, alignItems: 'center' },
  words: { flex: 1, gap: 2 },
  name: { ...type.title, color: colors.text },
  tagline: { ...type.caption, color: colors.subtle },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.snug, marginTop: space.tight },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { ...type.caption, color: colors.text, fontWeight: '600' },
  newShop: { ...type.caption, color: colors.subtle },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    paddingHorizontal: space.snug,
    paddingVertical: space.tight,
    borderRadius: RADII.pill,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { ...type.caption, color: colors.text },
});

const catalog = StyleSheet.create({
  wrap: { gap: space.cosy, marginTop: space.cosy },
  chips: { gap: space.snug, paddingVertical: 2 },
  chip: {
    paddingHorizontal: space.cosy,
    paddingVertical: space.snug,
    borderRadius: RADII.pill,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipText: { ...type.label, color: colors.text },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    padding: space.snug,
    borderRadius: RADII.chip,
  },
  noticeText: { ...type.caption, flex: 1 },
  disabled: { ...type.caption, color: colors.subtle },
  grid: { gap: space.snug },
  row: { flexDirection: 'row', gap: space.snug },
  cell: { flex: 1 },
  empty: { ...type.body, color: colors.subtle, textAlign: 'center', paddingVertical: space.section },
});

const card = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  art: { height: 116, alignItems: 'center', justifyContent: 'center', padding: space.cosy },
  badge: {
    position: 'absolute',
    top: space.snug,
    left: space.snug,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADII.hair,
  },
  badgeText: { ...type.caption, fontSize: 11, color: colors.onAccent, fontWeight: '700' },
  tap: { flex: 1 },
  words: { paddingHorizontal: space.snug, paddingTop: space.snug, gap: 2 },
  body: { paddingHorizontal: space.snug, paddingBottom: space.snug },
  name: { ...type.label, color: colors.text, minHeight: 36 },
  facts: { ...type.caption, fontSize: 11, color: colors.subtle },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: space.tight,
    gap: space.tight,
  },
  price: { ...type.label, fontSize: 16, flexShrink: 1 },
  unit: { ...type.caption, fontSize: 12, color: colors.subtle },
  plus: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADII.pill,
    paddingHorizontal: 4,
    gap: 2,
    height: 32,
  },
  step: { width: 26, height: 28, alignItems: 'center', justifyContent: 'center' },
  count: { ...type.label, minWidth: 16, textAlign: 'center' },
});
