/**
 * The customer's laundries as a shelf of cards, the way the App Store shelves
 * apps: a row that pages one card at a time, with the next one peeking in at
 * the edge so a thumb knows the row goes on.
 *
 * Each card is the shop's photo edge to edge, with a soft ice-blue foot under
 * a bright hairline where the words sit — never on the raw photo, since shop
 * photos are mostly flyers full of their own lettering. (The foot was the
 * photo blurred and whitened; it read as dirty white, so it is a clean blue
 * gradient now.) A sheen crosses the top corner the way light catches ice,
 * the logo rides the foot's edge as an app-icon tile, and the action is a
 * filled blue capsule. A shop with no photo gets the pastel light in its own
 * colour.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useId, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { GLASS_EDGE, PastelWash, glassChip } from "./glass";
import { ACCENTS, colors, fontFor, space, type } from "./ui-kit";
import { shopInitials } from "@/lib/domain/connected-shops";
import { LiftPressable } from "./lift-pressable";
import { ShopStatusPill } from "./shop-status-pill";
import type { ShopStatus } from "@/lib/domain/shop-availability";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type Accent = (typeof ACCENTS)[number];

/** Wide enough to lead the row, narrow enough that the next card peeks in. */
const CARD_WIDTH = 264;
const CARD_HEIGHT = 232;
/** The soft-blue foot the words sit on. */
const FROST_HEIGHT = 92;
const CARD_RADIUS = 28;
/** The foot's gradient, top to bottom: ice blue deepening to sky. */
const FROST_TOP = "#F1F6FF";
const FROST_BOTTOM = "#D9E7FF";
/** Just inside the card's border, so nothing paints over its hairline curve. */
const INNER_RADIUS = CARD_RADIUS - 1;
const CARD_GAP = space.cosy;
const SLOT = CARD_WIDTH + CARD_GAP;
/** The logo tile on the seam, and the white keyline around it. */
const TILE = 52;
const TILE_KEYLINE = 3;
/** An app icon's corner, as a share of its side. */
const TILE_ROUNDNESS = 0.24;
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
  /** Straight to a filled booking; null shows "Visit" instead. */
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
  const { railRef, pause, onScroll } = useAutoAdvance(shops.length);

  return (
    <ScrollView
      ref={railRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      // Bleeds past the page gutter so the row reads as running off screen.
      style={[styles.rail, WEB_SNAP_ROW]}
      contentContainerStyle={styles.railContent}
      decelerationRate="fast"
      snapToInterval={SLOT}
      snapToAlignment="start"
      scrollEventThrottle={64}
      onScroll={onScroll}
      onScrollBeginDrag={pause}
      onTouchStart={pause}
    >
      {shops.map((shop) => (
        <View key={shop.id} style={[styles.cardFrame, WEB_SNAP_CARD]}>
          <ShopCard shop={shop} onOpen={onOpen} onRebook={onRebook} />
        </View>
      ))}
    </ScrollView>
  );
}

/** How long each shop holds the front of the row before the next slides in. */
const ADVANCE_MS = 4000;
/** How long the row stays put after the customer last touched it. */
const RESUME_AFTER_MS = 8000;
/** Scroll events this soon after an automatic slide are the slide itself. */
const OWN_SCROLL_MS = 900;

/**
 * The shelf turns itself, one shop at a time, the way the App Store's
 * featured row does: every few seconds the next card slides to the front,
 * and after the last it glides back to the first.
 *
 * A finger always wins. Any touch, drag or scroll the row did not make
 * itself stops it, and it waits a while after the customer lets go before
 * moving again — a card must never slide out from under a thumb about to
 * tap it. One shop, or Reduce Motion, and it never moves at all.
 */
function useAutoAdvance(count: number) {
  const isReduced = useReducedMotion();
  const ref = useRef<ScrollView>(null);
  const index = useRef(0);
  const pausedUntil = useRef(0);
  const lastAutoAt = useRef(0);

  useEffect(() => {
    if (isReduced || count < 2) return;
    const id = setInterval(() => {
      const now = Date.now();
      if (now < pausedUntil.current) return;
      const next = index.current + 1 >= count ? 0 : index.current + 1;
      index.current = next;
      lastAutoAt.current = now;
      ref.current?.scrollTo({ x: next * SLOT, animated: true });
    }, ADVANCE_MS);
    return () => clearInterval(id);
  }, [count, isReduced]);

  const pause = () => {
    pausedUntil.current = Date.now() + RESUME_AFTER_MS;
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    index.current = Math.round(event.nativeEvent.contentOffset.x / SLOT);
    // The browser's wheel and trackpad never fire a drag, so a scroll the
    // row did not start is the customer's.
    if (Date.now() - lastAutoAt.current > OWN_SCROLL_MS) pause();
  };

  return { railRef: ref, pause, onScroll };
}

/** react-native-web ignores snapToInterval, so the browser's scroll snap does it there. */
const WEB_SNAP_ROW = Platform.select<ViewStyle | undefined>({
  web: {
    scrollSnapType: "x mandatory",
    scrollPaddingLeft: space.room,
  } as ViewStyle,
});
const WEB_SNAP_CARD = Platform.select<ViewStyle | undefined>({
  web: { scrollSnapAlign: "start" } as ViewStyle,
});

function ShopCard({
  shop,
  onOpen,
  onRebook,
}: {
  shop: RailShop;
  onOpen: (shopId: string) => void;
  onRebook: (href: string) => void;
}) {
  const { rebookHref, accent } = shop;
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const hasPhoto = !!shop.coverUrl && shop.coverUrl !== failedCover;
  const isShut = shop.status ? !shop.status.isTakingOrders : false;
  const canRebook = !isShut && !!rebookHref;

  // The card and its capsule are siblings, never one inside the other: a
  // button nested in a button is invalid on the web and ambiguous to a screen
  // reader. The capsule floats over the card's foot instead.
  return (
    <View>
      <LiftPressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${shop.name}${shop.meta ? `. ${shop.meta}` : ""}`}
        onPress={() => onOpen(shop.id)}
        style={styles.card}
      >
        {/* The shop, edge to edge. */}
        <View
          style={[styles.photoLayer, { backgroundColor: accent.surface }]}
          pointerEvents="none"
        >
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
            <PastelWash color={accent.ink} />
          )}
          <IceSheen />
        </View>

        {/* The foot: a soft blue gradient, clean under the words. */}
        <View style={styles.frost} pointerEvents="none">
          <FrostGradient />
        </View>

        {/* Lights off: a shop that cannot take an order right now dims. */}
        {isShut ? <View style={styles.lightsOff} pointerEvents="none" /> : null}
        {shop.status ? (
          <View style={styles.sign} pointerEvents="none">
            <ShopStatusPill status={shop.status} showDetail={false} />
          </View>
        ) : null}

        <View style={styles.tileSeat} pointerEvents="none">
          <ShopLogo
            name={shop.name}
            logoUrl={shop.logoUrl}
            accent={accent}
            size={TILE}
          />
        </View>

        <View style={styles.info}>
          <View style={styles.words} pointerEvents="none">
            <Text style={styles.name} numberOfLines={1}>
              {shop.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {isShut ? "Closed for now" : (shop.meta ?? " ")}
            </Text>
          </View>
          <View style={styles.getSpace} />
        </View>
      </LiftPressable>
      {canRebook && rebookHref ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Book again at ${shop.name}`}
          hitSlop={8}
          onPress={() => onRebook(rebookHref)}
          style={({ pressed }) => [
            styles.get,
            styles.getPrimary,
            styles.getFloat,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="refresh" size={14} color={colors.onAccent} />
          <Text style={[styles.getText, styles.getTextPrimary]}>Rebook</Text>
        </Pressable>
      ) : (
        <View style={[styles.get, styles.getGlass, styles.getFloat]} pointerEvents="none">
          <Text style={[styles.getText, isShut && { color: colors.subtle }]}>
            {isShut ? "View" : "Visit"}
          </Text>
        </View>
      )}
    </View>
  );
}

/** The foot's soft blue, lighter where it meets the photo. */
function FrostGradient() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={`frost${id}`} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={FROST_TOP} />
          <Stop offset="1" stopColor={FROST_BOTTOM} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#frost${id})`} />
    </Svg>
  );
}

/**
 * Light catching ice: a white glaze from the top-left corner that fades out
 * before the middle, over the photo and under everything else.
 */
function IceSheen() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
      <Defs>
        <LinearGradient id={`sheen${id}`} x1="0" y1="0" x2="0.7" y2="0.6">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.42} />
          <Stop offset="0.45" stopColor="#FFFFFF" stopOpacity={0.08} />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#sheen${id})`} />
    </Svg>
  );
}

/**
 * The logo on a tile shaped like an app icon. A square upload fills it edge to
 * edge; anything else is shown whole on white with a margin. A shop without a
 * logo — or with one that will not decode — shows its initials in its colour.
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
  const tile = {
    width: size,
    height: size,
    borderRadius: size * TILE_ROUNDNESS,
  };
  const inset = isSquare ? 0 : Math.round(size * 0.1);

  if (logoUrl && logoUrl !== failedUrl) {
    return (
      <View style={[styles.tile, tile]}>
        <Image
          source={{ uri: logoUrl }}
          style={{ width: size - inset * 2, height: size - inset * 2 }}
          contentFit={isSquare ? "cover" : "contain"}
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
    <View
      style={[styles.tile, tile, { backgroundColor: accent.surface }]}
      accessibilityLabel={`${name} logo`}
    >
      <Text
        style={[
          styles.initials,
          { color: accent.ink, fontSize: size * 0.34, lineHeight: size * 0.4 },
        ]}
      >
        {shopInitials(name.trim() || "Laundry shop")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { marginHorizontal: -space.room, flexGrow: 0 },
  railContent: {
    paddingHorizontal: space.room,
    // Room for the shadow, which a horizontal ScrollView clips.
    paddingTop: space.tight,
    paddingBottom: space.section,
    gap: CARD_GAP,
  },
  cardFrame: { width: CARD_WIDTH },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: CARD_RADIUS,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: GLASS_EDGE,
    overflow: "hidden",
    backgroundColor: colors.card,
    shadowColor: "#1B2559",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
    // Its own layer on the web, so the rounded clip holds under the lift.
    ...Platform.select<ViewStyle>({
      web: { isolation: "isolate" } as unknown as ViewStyle,
      default: {},
    }),
  },
  photoLayer: {
    ...StyleSheet.absoluteFill,
    borderRadius: INNER_RADIUS,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  frost: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: FROST_HEIGHT,
    overflow: "hidden",
    // Clipped to the card's own curve, so the frost cannot bleed past it.
    borderBottomLeftRadius: INNER_RADIUS,
    borderBottomRightRadius: INNER_RADIUS,
    borderCurve: "continuous",
    // The bright edge a sheet of frosted glass catches along its top.
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.85)",
  },
  lightsOff: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.36)",
  },
  sign: { position: "absolute", top: space.snug + 2, left: space.snug + 2 },
  tileSeat: {
    position: "absolute",
    top: CARD_HEIGHT - FROST_HEIGHT - TILE / 2 - TILE_KEYLINE,
    left: space.room - TILE_KEYLINE,
    padding: TILE_KEYLINE,
    borderRadius: TILE * TILE_ROUNDNESS + TILE_KEYLINE,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    shadowColor: "#1B2559",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tile: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderCurve: "continuous",
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  initials: { ...type.title },
  info: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingBottom: space.cosy + 2,
  },
  words: { flex: 1, minWidth: 0, gap: 2 },
  name: {
    ...type.body,
    fontSize: 17,
    lineHeight: 22,
    ...fontFor(600),
    color: colors.text,
  },
  meta: { ...type.caption, color: colors.subtle },
  get: {
    minWidth: 84,
    height: 32,
    paddingHorizontal: space.cosy + 2,
    borderRadius: 16,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  /** The one filled thing on the card: the way back to last time's load. */
  getPrimary: {
    backgroundColor: colors.action,
    shadowColor: colors.action,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  getGlass: { ...glassChip, borderRadius: 16 },
  /** The capsule's footprint in the row, so the words stop short of it. */
  getSpace: { width: 84 },
  getFloat: { position: "absolute", right: space.room, bottom: space.cosy + 8 },
  getText: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.2,
    ...fontFor(700),
    color: colors.action,
  },
  getTextPrimary: { color: colors.onAccent },
  pressed: { opacity: 0.6 },
});
