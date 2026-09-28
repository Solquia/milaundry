/**
 * The customer's laundries as a carousel of photo cards.
 *
 * Each card is a profile: the shop's photo as a window across the top, its
 * logo on the seam below it, and the name and last order on plain white under
 * that. Words never sit on the photo — shop photos are mostly flyers full of
 * their own lettering, and no fade makes type read over type. The action —
 * "Book again" or "Visit shop" — hangs off the card's bottom edge so it reads
 * as part of the card, not a row under it. A shop with no photo gets suds in
 * its own colour instead, so the row never shows a hole.
 *
 * The logo is always drawn whole: *contained* on white rather than cropped to
 * fill a disc, which cut the lettering off most laundry badges.
 *
 * It replaces two stacked lists — RECENT SHOPS and OTHER SHOPS — whose rows
 * looked identical and pushed everything else below the fold. One row holds
 * every shop, recent ones first, at a fixed height however many there are.
 *
 * The row is a carousel: the shop in the middle stands full size, and its
 * neighbours sit shrunk and faded either side of it, tucked in close. Swiping
 * brings the next one into the middle, where it grows as it arrives. Tapping a
 * shop at the side brings it into the middle rather than opening it, so what a
 * tap does always matches what is in focus.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from 'react-native';

import { ACCENTS, colors, elevation, space, type } from './ui-kit';
import { shopInitials } from '@/lib/domain/connected-shops';
import { LiftPressable } from './lift-pressable';
import { ShopStatusPill } from './shop-status-pill';
import type { ShopStatus } from '@/lib/domain/shop-availability';

type Accent = (typeof ACCENTS)[number];

/** The card in the middle: wide enough to lead the row, narrow enough to peek both neighbours. */
const CARD_WIDTH = 200;
/** The photo is a window in the card's top, not a backdrop for the words. */
const PHOTO_HEIGHT = 128;
const CARD_RADIUS = 26;
const CARD_GAP = space.cosy;
/** One step of the carousel: a card and the gap after it. */
const SLOT = CARD_WIDTH + CARD_GAP;
/** A neighbour's size and strength beside the card in focus. */
const SIDE_SCALE = 0.84;
const SIDE_OPACITY = 0.55;
/** How far a neighbour slides in to close the gap its shrinking opened. */
const SIDE_TUCK = (CARD_WIDTH * (1 - SIDE_SCALE)) / 2;
/** The native driver cannot run on web; there the JS driver animates the same values. */
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** The action pill: how tall, and how much of it hangs over the photo's edge. */
const CTA_HEIGHT = 42;
const CTA_OVERLAP = CTA_HEIGHT / 2;
/** The logo on the seam: a white disc, a ring in the shop's colour, a white halo. */
const BADGE_SIZE = 58;
const BADGE_RING = 2;
const BADGE_HALO = 4;
const BADGE_OUTER = BADGE_SIZE + (BADGE_RING + BADGE_HALO) * 2;
/** Corner radius as a share of the tile's side: an app icon's squircle. */
const TILE_ROUNDNESS = 0.28;
/** How far from 1:1 an upload can be and still fill the tile edge to edge. */
const SQUARE_TOLERANCE = 0.08;

export interface RailShop {
  id: string;
  name: string;
  logoUrl: string | null;
  /** Photo of the physical shop, filling the card; null for none. */
  coverUrl: string | null;
  accent: Accent;
  /** "Full Wash and fold · 8.5 kg" for a shop used before, else its address. */
  meta: string | null;
  /** Straight to a filled booking; null shows "Visit shop" instead. */
  rebookHref: string | null;
  /** The sign on the shop's door; null or absent shows no sign. */
  status?: ShopStatus | null;
}

interface ShopRailProps {
  shops: readonly RailShop[];
  onOpen: (shopId: string) => void;
  onRebook: (href: string) => void;
}

export function ShopRail({ shops, onOpen, onRebook }: ShopRailProps) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const { width: windowWidth } = useWindowDimensions();
  const [railWidth, setRailWidth] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);

  // Padding either side lets the first and last shops reach the middle too.
  const sidePad = Math.max(((railWidth || windowWidth) - CARD_WIDTH) / 2, space.room);
  const activeIndex = Math.min(focusedIndex, Math.max(shops.length - 1, 0));

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
    useNativeDriver: USE_NATIVE_DRIVER,
    listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      setFocusedIndex(Math.max(0, Math.round(event.nativeEvent.contentOffset.x / SLOT)));
    },
  });

  const bringToMiddle = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * SLOT, animated: true });
  };

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      // Bleeds past the sheet's gutter so the row reads as continuing off
      // screen, which is what tells a thumb it scrolls.
      style={[styles.rail, WEB_SNAP_ROW]}
      contentContainerStyle={[styles.railContent, { paddingHorizontal: sidePad }]}
      onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}
      onScroll={onScroll}
      scrollEventThrottle={16}
      decelerationRate="fast"
      snapToInterval={SLOT}
    >
      {shops.map((shop, index) => (
        <Animated.View
          key={shop.id}
          style={[styles.cardFrame, WEB_SNAP_CARD, focusStyle(scrollX, index)]}
        >
          <ShopCard
            shop={shop}
            isActive={index === activeIndex}
            onFocus={() => bringToMiddle(index)}
            onOpen={onOpen}
            onRebook={onRebook}
          />
        </Animated.View>
      ))}
    </Animated.ScrollView>
  );
}

/** Full size in the middle; shrunk, faded and tucked in one step either side. */
function focusStyle(scrollX: Animated.Value, index: number) {
  const inputRange = [(index - 1) * SLOT, index * SLOT, (index + 1) * SLOT];
  const interpolate = (outputRange: number[]) =>
    scrollX.interpolate({ inputRange, outputRange, extrapolate: 'clamp' });
  return {
    opacity: interpolate([SIDE_OPACITY, 1, SIDE_OPACITY]),
    transform: [
      { translateX: interpolate([-SIDE_TUCK, 0, SIDE_TUCK]) },
      { scale: interpolate([SIDE_SCALE, 1, SIDE_SCALE]) },
    ],
  };
}

/**
 * react-native-web ignores snapToInterval, so the browser's own scroll snap
 * does the same job there: each card settles centred.
 */
const WEB_SNAP_ROW = Platform.select<ViewStyle | undefined>({
  web: { scrollSnapType: 'x mandatory' } as ViewStyle,
});
const WEB_SNAP_CARD = Platform.select<ViewStyle | undefined>({
  web: { scrollSnapAlign: 'center' } as ViewStyle,
});

function ShopCard({
  shop,
  isActive,
  onFocus,
  onOpen,
  onRebook,
}: {
  shop: RailShop;
  isActive: boolean;
  onFocus: () => void;
  onOpen: (shopId: string) => void;
  onRebook: (href: string) => void;
}) {
  const { rebookHref, accent } = shop;
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const hasPhoto = !!shop.coverUrl && shop.coverUrl !== failedCover;
  const isShut = shop.status ? !shop.status.isTakingOrders : false;

  return (
    <View style={styles.wrap}>
      <LiftPressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${shop.name}${shop.meta ? `. ${shop.meta}` : ''}`}
        onPress={() => (isActive ? onOpen(shop.id) : onFocus())}
        style={styles.card}
      >
        <View style={[styles.photo, { backgroundColor: accent.surface }]} pointerEvents="none">
          {hasPhoto && shop.coverUrl ? (
            <Image
              source={{ uri: shop.coverUrl }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={200}
              accessible={false}
              onError={() => setFailedCover(shop.coverUrl)}
            />
          ) : (
            <Suds accent={accent} />
          )}
          {/* Lights off: a shop that cannot take an order right now dims,
              so the row shows at a glance which doors are shut. */}
          {isShut ? <View style={styles.lightsOff} /> : null}
          {shop.status ? (
            <ShopStatusPill status={shop.status} showDetail={isActive} style={styles.sign} />
          ) : null}
        </View>

        <View style={styles.info} pointerEvents="none">
          <Text style={styles.name} numberOfLines={1}>
            {shop.name}
          </Text>
          <Text style={styles.meta} numberOfLines={2}>
            {shop.meta ?? ' '}
          </Text>
        </View>

        {/* The logo rides the seam between photo and words, ringed in the
            shop's colour and haloed in white so it cuts cleanly into any photo. */}
        <View style={styles.badge} pointerEvents="none">
          <View style={[styles.badgeRing, { backgroundColor: accent.ink }]}>
            <ShopLogo name={shop.name} logoUrl={shop.logoUrl} accent={accent} size={BADGE_SIZE} />
          </View>
        </View>
      </LiftPressable>

      {isShut ? (
        // Book again cannot go through while the sign says CLOSED, so it
        // does not pretend to: the pill opens the shop, where the sign says why.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${shop.name} is closed for now. Open the shop.`}
          onPress={() => (isActive ? onOpen(shop.id) : onFocus())}
          style={({ pressed }) => [styles.cta, styles.ctaQuiet, pressed && styles.pressed]}
        >
          <Ionicons name="moon" size={14} color={colors.subtle} />
          <Text style={[styles.ctaText, { color: colors.subtle }]}>Closed for now</Text>
        </Pressable>
      ) : rebookHref ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Book again at ${shop.name}`}
          onPress={() => (isActive ? onRebook(rebookHref) : onFocus())}
          style={({ pressed }) => [styles.cta, styles.ctaFilled, pressed && styles.pressed]}
        >
          <Ionicons name="refresh" size={15} color={colors.onAccent} />
          <Text style={[styles.ctaText, { color: colors.onAccent }]}>Book again</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Visit ${shop.name}`}
          onPress={() => (isActive ? onOpen(shop.id) : onFocus())}
          style={({ pressed }) => [styles.cta, styles.ctaQuiet, pressed && styles.pressed]}
        >
          <Text style={[styles.ctaText, { color: accent.ink }]}>Visit shop</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Soap bubbles as [left, top, size], in points across the photo window. */
const BUBBLES: readonly (readonly [number, number, number])[] = [
  [-18, 58, 84],
  [58, -22, 64],
  [128, 30, 96],
  [96, 92, 30],
  [30, 18, 18],
  [166, 8, 22],
];

/**
 * A shop with no photo: suds in its own colour where the photo would be, so
 * the card still has a picture and the logo on the seam still has something
 * to sit over.
 */
function Suds({ accent }: { accent: Accent }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      {BUBBLES.map(([left, top, size]) => (
        <View
          key={`${left}:${top}`}
          style={[
            styles.bubble,
            { left, top, width: size, height: size, borderRadius: size / 2, borderColor: accent.ink },
          ]}
        />
      ))}
    </View>
  );
}

/**
 * The logo on a tile shaped like an app icon. A disc only fits a round mark;
 * a square logo — most of them, often on their own dark ground — sat shrunk
 * inside it like a stamp on a coin. On a tile both fit: a square upload fills
 * it edge to edge, and a round one sits inside the square whole, only its
 * blank corners trimmed by the tile's. Anything wider or taller than square
 * is shown whole on white with a margin. A shop without a logo — or with one
 * that will not decode — shows its initials in its own colour.
 */
function ShopLogo({
  name,
  logoUrl,
  accent,
  size,
}: {
  name: string;
  logoUrl: string | null;
  accent: Accent;
  size: number;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [isSquare, setIsSquare] = useState(false);
  const tile = { width: size, height: size, borderRadius: size * TILE_ROUNDNESS };
  // The margin a printed label leaves round a mark, so no lettering touches the edge.
  const inset = isSquare ? 0 : Math.round(size * 0.1);

  if (logoUrl && logoUrl !== failedUrl) {
    return (
      <View style={[styles.tile, tile]}>
        <Image
          source={{ uri: logoUrl }}
          style={{ width: size - inset * 2, height: size - inset * 2 }}
          contentFit={isSquare ? 'cover' : 'contain'}
          transition={150}
          accessibilityLabel={`${name} logo`}
          onLoad={({ source }) => {
            const ratio = source.width / Math.max(source.height, 1);
            setIsSquare(Math.abs(ratio - 1) <= SQUARE_TOLERANCE);
          }}
          onError={() => setFailedUrl(logoUrl)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.tile, tile]} accessibilityLabel={`${name} logo`}>
      <Text
        style={[
          styles.initials,
          { color: accent.ink, fontSize: size * 0.3, lineHeight: size * 0.36 },
        ]}
      >
        {shopInitials(name.trim() || 'Laundry shop')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { marginHorizontal: -space.room, flexGrow: 0 },
  railContent: {
    // Room for the lift and the shadow, which a horizontal ScrollView clips.
    paddingTop: space.cosy,
    paddingBottom: space.room,
    gap: CARD_GAP,
  },
  cardFrame: { width: CARD_WIDTH },
  wrap: { alignItems: 'center' },
  card: {
    width: CARD_WIDTH,
    borderRadius: CARD_RADIUS,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    // Rounds the photo's top corners with the card's.
    overflow: 'hidden',
    ...elevation.lift,
  },
  photo: { height: PHOTO_HEIGHT, overflow: 'hidden' },
  bubble: { position: 'absolute', borderWidth: 2, opacity: 0.16 },
  lightsOff: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(11,27,43,0.45)' },
  sign: {
    position: 'absolute',
    top: space.snug,
    left: space.snug,
    maxWidth: CARD_WIDTH - space.snug * 2,
    ...elevation.rest,
  },
  info: {
    alignItems: 'center',
    paddingHorizontal: space.room,
    // Below the half of the badge that hangs into the panel.
    paddingTop: BADGE_OUTER / 2 + space.snug,
    // Clear of the pill that hangs over the bottom edge.
    paddingBottom: CTA_OVERLAP + space.cosy,
    gap: 2,
  },
  badge: {
    position: 'absolute',
    top: PHOTO_HEIGHT - BADGE_OUTER / 2,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  badgeRing: {
    padding: BADGE_RING,
    // Concentric with the tile inside it, so the ring runs an even width.
    borderRadius: BADGE_SIZE * TILE_ROUNDNESS + BADGE_RING + BADGE_HALO,
    borderWidth: BADGE_HALO,
    borderColor: colors.card,
    ...elevation.rest,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  initials: { ...type.title },
  name: { ...type.label, fontSize: 16, lineHeight: 21, color: colors.text, textAlign: 'center' },
  meta: {
    ...type.caption,
    fontSize: 12,
    lineHeight: 16,
    minHeight: 32,
    color: colors.subtle,
    textAlign: 'center',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.tight + 2,
    height: CTA_HEIGHT,
    minWidth: CARD_WIDTH * 0.68,
    paddingHorizontal: space.section,
    marginTop: -CTA_OVERLAP,
    borderRadius: 999,
    ...elevation.lift,
  },
  ctaFilled: { backgroundColor: colors.action },
  ctaQuiet: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  ctaText: { ...type.label, fontSize: 14 },
  pressed: { opacity: 0.85 },
});
