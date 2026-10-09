/**
 * The spotlight storefront: the shop the way McDonald's sells a burger.
 *
 * A tinted header that greets the customer and asks what needs washing, with
 * the basket in its corner and a search under it; deal cards in the shop's
 * colour (`spotlight-hero`); round category pictures; a featured rail; an
 * offer strip; then every service as a product card on a two-up grid
 * (`spotlight-grid`). Tapping a card raises its sheet (`spotlight-sheet`);
 * "+" adds without leaving the grid. The basket and the checkout are the
 * market's, so ordering is the same whichever look the shop wears.
 *
 * One rule holds it together: every picture is a product shot on a tint of
 * the shop's own colour, and every action is that colour at full strength.
 *
 * The header and the body share state through `useSpotlight`, because the
 * page draws them in different places: the app stacks them in one scroll,
 * the web page puts the header in its full-width slot.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SearchField } from './search-field';
import { ServicePhoto } from './service-photo';
import { ShopLogo } from './shop-logo';
import { ShopStatusPill } from './shop-status-pill';
import { ALL, CategoryCircles, ProductCard, ServiceGrid, type ServiceFilter } from './spotlight-grid';
import { SpotlightPromos } from './spotlight-hero';
import { SpotlightSheet } from './spotlight-sheet';
import { ACCENTS, RADII, colors, elevation, space, type } from './ui-kit';
import { storefrontGreeting } from '@/lib/domain/home-greeting';
import { formatMoneyCompact } from '@/lib/domain/money';
import type { Cart } from '@/lib/domain/market-cart';
import type { ShopStatus } from '@/lib/domain/shop-availability';
import {
  cheapestId,
  matchesQuery,
  serviceFrames,
  spotlightBanners,
  spotlightPicks,
  spotlightSections,
  type SpotlightBanner,
  type SpotlightService,
} from '@/lib/domain/spotlight';
import type { Reputation } from '@/lib/domain/storefront';

type Accent = (typeof ACCENTS)[number];

interface UseSpotlightInput<T extends SpotlightService> {
  services: readonly T[];
  reputation: Reputation | null;
  /** Scrolls the page to a content offset; absent where the page cannot be scrolled from here. */
  scrollTo?: (y: number) => void;
}

/** What the header and the body share: the filter, the search, the open sheet, the way to the grid. */
export function useSpotlight<T extends SpotlightService>({ services, reputation, scrollTo }: UseSpotlightInput<T>) {
  const [filter, setFilter] = useState<ServiceFilter>(ALL);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const gridY = useRef(0);
  const webJump = useRef<(() => void) | null>(null);

  const banners = useMemo(() => spotlightBanners({ services, reputation }), [services, reputation]);
  const sections = useMemo(() => spotlightSections(services), [services]);
  const picks = useMemo(() => spotlightPicks(services), [services]);
  const frames = useMemo(() => serviceFrames(services), [services]);
  const lowestId = useMemo(() => cheapestId(services), [services]);

  // A search looks through everything; otherwise the chosen category, or all
  // of them when the chosen one has since emptied.
  const isSearching = query.trim().length > 0;
  const filtered = sections.filter((section) => section.category === filter);
  const shown = isSearching
    ? sections
        .map((section) => ({ ...section, services: section.services.filter((s) => matchesQuery(s, query)) }))
        .filter((section) => section.services.length > 0)
    : filter === ALL || filtered.length === 0
      ? sections
      : filtered;
  const opened = services.find((service) => service.id === openId) ?? null;

  const jumpToGrid = () => {
    if (scrollTo) scrollTo(Math.max(0, gridY.current - space.snug));
    else webJump.current?.();
  };

  const choose = (next: ServiceFilter) => {
    setFilter(next);
    setQuery('');
    jumpToGrid();
  };

  const onBanner = (banner: SpotlightBanner) => {
    const { action } = banner;
    if (action.kind === 'service') setOpenId(action.serviceId);
    else if (action.kind === 'category') choose(action.category);
    else choose(ALL);
  };

  return {
    banners,
    sections,
    shown,
    picks,
    frames,
    lowestId,
    filter,
    query,
    isSearching,
    opened,
    choose,
    onBanner,
    setQuery,
    open: (service: T) => setOpenId(service.id),
    close: () => setOpenId(null),
    /** Where the grid starts, in the page's scroll content; set by the body as it lays out. */
    setGridY: (y: number) => {
      gridY.current = y;
    },
    /** How the body brings its grid into view where there is no scroller to drive. */
    setWebJump: (jump: (() => void) | null) => {
      webJump.current = jump;
    },
  };
}

export type Spotlight<T extends SpotlightService> = ReturnType<typeof useSpotlight<T>>;

// ── the header ────────────────────────────────────────────────────────────

interface SpotlightHeaderProps {
  name: string;
  logoUrl: string | null;
  accent: Accent;
  reputation: Reputation | null;
  sign: ShopStatus | null;
  /** The cheapest price on the list. */
  cheapest: number | null;
  /** The customer's name for the greeting, when there is one. */
  customerName?: string | null;
  basketCount: number;
  /** Goes to checkout; absent while the basket is empty or ordering is blocked. */
  onBasket?: () => void;
  query: string;
  onQuery: (next: string) => void;
  insetTop?: number;
  onBack?: () => void;
  /** A Connect button, or nothing once the customer is connected. */
  action?: React.ReactNode;
  /** In a padded screen the band bleeds past the padding (the app); on the web it already spans. */
  isInset?: boolean;
  /** On a wide window the colour spans it but the words keep to the page's column. */
  contentWidth?: number;
}

export function SpotlightHeader({
  name,
  logoUrl,
  accent,
  reputation,
  sign,
  cheapest,
  customerName,
  basketCount,
  onBasket,
  query,
  onQuery,
  insetTop = 0,
  onBack,
  action,
  isInset = false,
  contentWidth,
}: SpotlightHeaderProps) {
  const hello = storefrontGreeting(customerName).hello.replace(/,$/, '');
  return (
    <View
      style={[
        header.band,
        !isInset && header.bleed,
        { backgroundColor: accent.surface, paddingTop: insetTop + space.cosy },
      ]}
    >
      <View style={[header.inner, contentWidth ? { maxWidth: contentWidth } : null]}>
      {/* The shop leads: its logo and name are the biggest things here, the
          way a brand's own app opens on its mark, not the app's question. */}
      <View style={header.identity}>
        {onBack ? <RoundButton icon="chevron-back" label="Back" onPress={onBack} /> : null}
        <View style={[header.logoPlate, elevation.rest]}>
          <ShopLogo name={name} logoUrl={logoUrl} size={64} accent={accent} shape="plate" />
        </View>
        <View style={header.shop}>
          <Text style={header.shopName} numberOfLines={2} accessibilityRole="header">
            {name}
          </Text>
          <View style={header.meta}>
            {reputation ? (
              <View style={header.rating}>
                <Ionicons name="star" size={13} color="#E0A100" />
                <Text style={header.metaStrong}>{reputation.average.toFixed(1)}</Text>
                <Text style={header.metaText}>({reputation.count})</Text>
              </View>
            ) : (
              <Text style={header.metaText}>New shop</Text>
            )}
            {cheapest !== null ? (
              <Text style={header.metaText}>· from {formatMoneyCompact(cheapest)}</Text>
            ) : null}
          </View>
          {sign ? <ShopStatusPill status={sign} showDetail={false} style={header.pill} /> : null}
        </View>
        <BasketButton count={basketCount} accent={accent} onPress={onBasket} />
      </View>

      <View style={header.words}>
        <Text style={[header.hello, { color: accent.ink }]}>{hello} 👋</Text>
        <Text style={header.title}>What needs washing today?</Text>
      </View>

      <SearchField
        value={query}
        onChangeText={onQuery}
        placeholder="Search services"
        accessibilityLabel="Search this shop's services"
      />
      {action}
      </View>
    </View>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [header.round, elevation.rest, pressed && header.pressed]}
    >
      <Ionicons name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

function BasketButton({ count, accent, onPress }: { count: number; accent: Accent; onPress?: () => void }) {
  const label = count === 0 ? 'Basket, empty' : `Basket, ${count} ${count === 1 ? 'item' : 'items'}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [header.round, elevation.rest, pressed && header.pressed]}
    >
      <Ionicons name="basket-outline" size={22} color={colors.text} />
      {count > 0 ? (
        <View style={[header.badge, { backgroundColor: accent.ink }]}>
          <Text style={header.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ── the body ──────────────────────────────────────────────────────────────

interface SpotlightBodyProps<T extends SpotlightService> {
  spot: Spotlight<T>;
  accent: Accent;
  cart: Cart;
  onAdd: (service: T) => void;
  onRemove: (serviceId: string) => void;
  /** Shown but not addable: the app before the customer has connected. */
  isDisabled?: boolean;
  /** "Swapped for Wash-Dry · 1 load per order". */
  notice?: string | null;
  /** What sits under the offers: a welcome, the wash in progress, an order to track. */
  children?: React.ReactNode;
}

const FEATURE_WIDTH = 176;

export function SpotlightBody<T extends SpotlightService>({
  spot,
  accent,
  cart,
  onAdd,
  onRemove,
  isDisabled = false,
  notice,
  children,
}: SpotlightBodyProps<T>) {
  // Both offsets are kept, because the grid's layout can arrive before the
  // root's; either one landing recomputes where the grid starts.
  const rootY = useRef(0);
  const gridLocalY = useRef(0);
  const gridView = useRef<View>(null);
  const { setWebJump, setGridY } = spot;
  const opened = spot.opened;

  // The web page scrolls in a container this screen does not own; there a
  // View is a DOM element, which can bring itself into view.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    setWebJump(() => {
      const element = gridView.current as unknown as { scrollIntoView?: (options: object) => void } | null;
      element?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });
    return () => setWebJump(null);
  }, [setWebJump]);

  const hasServices = spot.sections.length > 0;

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        rootY.current = event.nativeEvent.layout.y;
        setGridY(rootY.current + gridLocalY.current);
      }}
    >
      {spot.isSearching ? null : <SpotlightPromos banners={spot.banners} accent={accent} onAction={spot.onBanner} />}
      {children}

      {!spot.isSearching && spot.sections.length > 1 ? (
        <View style={styles.block}>
          <SectionHead title="Categories" />
          <CategoryCircles sections={spot.sections} filter={spot.filter} accent={accent} onChoose={spot.choose} />
        </View>
      ) : null}

      {!spot.isSearching && spot.picks.length > 1 ? (
        <View style={styles.block}>
          <SectionHead title="Featured services" link="See all" onLink={() => spot.choose(ALL)} accent={accent} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {spot.picks.map((service) => (
              <ProductCard
                key={service.id}
                service={service}
                frame={spot.frames.get(service.id)}
                lowestId={spot.lowestId}
                quantity={cart[service.id] ?? 0}
                accent={accent}
                isDisabled={isDisabled}
                width={FEATURE_WIDTH}
                onOpen={() => spot.open(service)}
                onAdd={() => onAdd(service)}
                onRemove={() => onRemove(service.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {!spot.isSearching && hasServices ? <OfferStrip accent={accent} spot={spot} /> : null}

      <View
        ref={gridView}
        style={styles.block}
        onLayout={(event) => {
          gridLocalY.current = event.nativeEvent.layout.y;
          setGridY(rootY.current + gridLocalY.current);
        }}
      >
        <SectionHead
          title={spot.isSearching ? 'Results' : 'All services'}
          caption={isDisabled ? 'Connect to the shop to order' : 'Tap a card for details, + to add'}
        />
        {notice ? (
          <View style={[styles.notice, { backgroundColor: accent.surface }]} accessibilityLiveRegion="polite">
            <Ionicons name="swap-horizontal" size={16} color={accent.ink} />
            <Text style={[styles.noticeText, { color: accent.ink }]}>{notice}</Text>
          </View>
        ) : null}
        {spot.shown.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name={hasServices ? 'search' : 'shirt-outline'} size={28} color={colors.subtle} />
            <Text style={styles.emptyText}>{hasServices ? 'No service matches that search' : 'No services yet'}</Text>
          </View>
        ) : (
          <ServiceGrid
            sections={spot.shown}
            frames={spot.frames}
            lowestId={spot.lowestId}
            cart={cart}
            accent={accent}
            isDisabled={isDisabled}
            onOpen={spot.open}
            onAdd={onAdd}
            onRemove={onRemove}
          />
        )}
      </View>

      <SpotlightSheet
        service={opened}
        frame={opened ? spot.frames.get(opened.id) : undefined}
        quantity={opened ? cart[opened.id] ?? 0 : 0}
        accent={accent}
        isDisabled={isDisabled}
        onAdd={() => {
          if (opened) onAdd(opened);
        }}
        onRemove={() => {
          if (opened) onRemove(opened.id);
        }}
        onClose={spot.close}
      />
    </View>
  );
}

function SectionHead({
  title,
  caption,
  link,
  onLink,
  accent,
}: {
  title: string;
  caption?: string;
  link?: string;
  onLink?: () => void;
  accent?: Accent;
}) {
  return (
    <View style={styles.head}>
      <View style={styles.headWords}>
        <Text style={styles.headTitle} accessibilityRole="header">
          {title}
        </Text>
        {caption ? <Text style={styles.headCaption}>{caption}</Text> : null}
      </View>
      {link && onLink ? (
        <Pressable accessibilityRole="button" onPress={onLink} hitSlop={8} style={styles.headLink}>
          <Text style={[styles.headLinkText, accent && { color: accent.ink }]}>{link}</Text>
          <Ionicons name="arrow-forward" size={14} color={accent?.ink ?? colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The strip McDonald's runs between its rails. Ours says the one thing this
 * look offers that a counter does not — every service in one basket — over
 * two of the shop's own product shots.
 */
function OfferStrip<T extends SpotlightService>({ accent, spot }: { accent: Accent; spot: Spotlight<T> }) {
  const photos = spot.sections.slice(0, 2).map((section) => section.photo);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="One basket, one checkout. See all services."
      onPress={() => spot.choose(ALL)}
      style={({ pressed }) => [styles.offer, { borderColor: accent.ink }, pressed && styles.pressed]}
    >
      <View style={styles.offerWords}>
        <Text style={[styles.offerKicker, { color: accent.ink }]}>ONE BASKET</Text>
        <Text style={styles.offerTitle}>Mix any services,{'\n'}check out once</Text>
        <View style={[styles.offerCta, { backgroundColor: accent.ink }]}>
          <Text style={styles.offerCtaText}>Start a basket</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.onAccent} />
        </View>
      </View>
      <View style={styles.offerPhotos}>
        {photos.map((photo, index) => (
          <ServicePhoto
            key={photo + index}
            photo={photo}
            style={[
              styles.offerPhoto,
              { backgroundColor: accent.surface },
              index === 1 && styles.offerPhotoBack,
            ]}
          />
        ))}
      </View>
    </Pressable>
  );
}

const header = StyleSheet.create({
  band: {
    paddingHorizontal: space.room,
    paddingBottom: space.room,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  inner: { width: '100%', alignSelf: 'center', gap: space.cosy },
  bleed: { marginHorizontal: -space.room, marginTop: -space.room },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  logoPlate: { padding: 4, borderRadius: 22, backgroundColor: colors.card },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  shop: { flex: 1, gap: 3 },
  shopName: { ...type.title, fontSize: 24, lineHeight: 28, color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { ...type.caption, fontSize: 13, color: colors.subtle },
  metaStrong: { ...type.caption, fontSize: 13, color: colors.text, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  badgeText: { ...type.caption, fontSize: 10, fontWeight: '800', color: colors.onAccent },
  words: { gap: 2, marginTop: space.tight },
  hello: { ...type.label },
  title: { ...type.section, fontSize: 21, lineHeight: 26, color: colors.text },
  pill: { alignSelf: 'flex-start', marginTop: space.tight },
});

const styles = StyleSheet.create({
  root: { gap: space.section + 4 },
  block: { gap: space.cosy },
  head: { flexDirection: 'row', alignItems: 'flex-end', gap: space.snug },
  headWords: { flex: 1, gap: 2 },
  headTitle: { ...type.section, color: colors.text },
  headCaption: { ...type.caption, color: colors.subtle },
  headLink: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingBottom: 2 },
  headLinkText: { ...type.label, fontSize: 13 },
  rail: { gap: space.cosy - 2, paddingVertical: space.tight, paddingRight: space.room },
  pressed: { opacity: 0.9 },

  offer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 132,
    borderRadius: RADII.sheet,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: colors.card,
    padding: space.room,
    overflow: 'hidden',
  },
  offerWords: { flex: 1, gap: 4 },
  offerKicker: { ...type.caption, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  offerTitle: { ...type.section, fontSize: 18, lineHeight: 22, color: colors.text },
  offerCta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: space.tight,
    paddingHorizontal: space.cosy,
    height: 30,
    borderRadius: RADII.pill,
  },
  offerCtaText: { ...type.label, fontSize: 12.5, color: colors.onAccent },
  offerPhotos: { width: 118, height: 100 },
  offerPhoto: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: colors.card,
  },
  offerPhotoBack: { right: 52, bottom: 26, width: 64, height: 64, borderRadius: 32 },

  notice: { flexDirection: 'row', alignItems: 'center', gap: space.snug, padding: space.snug, borderRadius: RADII.chip },
  noticeText: { ...type.caption, flex: 1 },
  empty: { alignItems: 'center', gap: space.snug, paddingVertical: space.gulf },
  emptyText: { ...type.body, color: colors.subtle },
});
