/**
 * The shopfront's header, laid out the way a store page on a marketplace is:
 * a cover banner across the top, and a white store card that overlaps its
 * foot carrying the logo, the name, where it is, and a row of numbers.
 *
 * It used to put everything *on* the photo — a navy pill for the name, white
 * text over whatever the photo happened to show, and an arc cut into the
 * bottom. On a busy photo the words fought the picture and the picture lost
 * its point. Now the photo is only a photo, and the words sit on the card
 * where they stay legible whatever the shop uploaded.
 *
 * The mark is the shop's real logo; initials only when none was uploaded.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

import { ClaimRings, claimFill, claimSwell } from '@/components/claim';
import { WashLine, useCue } from '@/components/entrance';
import { ACCENTS, HERO_GRADIENT, colors, elevation, space, type } from '@/components/ui-kit';
import { shopInitials } from '@/lib/domain/connected-shops';
import type { ConnectionRank } from '@/lib/domain/connection-welcome';
import { ENTRANCE } from '@/lib/domain/entrance';
import { formatMoneyCompact } from '@/lib/domain/money';
import { heroBackdrop } from '@/lib/domain/shop-cover';
import type { Reputation } from '@/lib/domain/storefront';

type Accent = (typeof ACCENTS)[number];

/** The banner's height below the safe-area inset: a photo, not a poster. */
const COVER_HEIGHT = 190;
/** The banner's bottom corners, a step rounder than the card's 20. */
const COVER_RADIUS = 28;
/** How far the store card rides up over the banner. */
const CARD_OVERLAP = 36;
/** The shop's mark, half of it standing above the card's top edge. */
const MARK_SIZE = 72;
/** The app's deep navy, used for the scrim so the photo darkens into brand. */
const SCRIM = '#04203F';
/** Rating gold; the only star on the card, so it can afford to be warm. */
const STAR = '#F5B400';

interface ShopfrontHeroProps {
  name: string;
  /** The shop's own line about itself; '' when they have not written one. */
  tagline: string;
  address: string;
  /** The logo the shop uploaded; null draws the initials. */
  logoUrl: string | null;
  /** The photo of the shop; null keeps the coloured field. */
  coverUrl: string | null;
  isRegistered: boolean;
  accent: Accent;
  reputation: Reputation | null;
  cheapest: number | null;
  serviceCount: number;
  onConnect: () => void;
  isConnecting: boolean;
  insetTop: number;
  onBack: () => void;
  progress: Animated.Value;
  /** The claim gesture's driver, at rest unless a connection just landed. */
  claim: Animated.Value;
  isClaiming: boolean;
  rank: ConnectionRank;
}

interface Stat {
  key: string;
  value: string;
  label: string;
  hasStar?: boolean;
}

/**
 * The numbers a shopper compares stores by. A shop with no reviews still gets
 * the rating column, reading "New", so the strip never collapses to one cell.
 */
function storeStats(
  reputation: Reputation | null,
  cheapest: number | null,
  serviceCount: number
): Stat[] {
  const rating: Stat = reputation
    ? {
        key: 'rating',
        value: reputation.average.toFixed(1),
        label: `${reputation.count} ${reputation.count === 1 ? 'review' : 'reviews'}`,
        hasStar: true,
      }
    : { key: 'rating', value: 'New', label: 'No reviews yet' };
  const price: Stat | null =
    cheapest === null
      ? null
      : { key: 'price', value: formatMoneyCompact(cheapest), label: 'Starting price' };
  const services: Stat | null =
    serviceCount === 0
      ? null
      : {
          key: 'services',
          value: String(serviceCount),
          label: serviceCount === 1 ? 'Service' : 'Services',
        };
  return [rating, price, services].filter((stat): stat is Stat => stat !== null);
}

export function ShopfrontHero({
  name,
  tagline,
  address,
  logoUrl,
  coverUrl,
  isRegistered,
  accent,
  reputation,
  cheapest,
  serviceCount,
  onConnect,
  isConnecting,
  insetTop,
  onBack,
  progress,
  claim,
  isClaiming,
  rank,
}: ShopfrontHeroProps) {
  // Percentage sizing on <Svg> does not resolve against a flex parent in
  // react-native-svg. Measure the box and paint in real pixels.
  const [field, setField] = useState({ width: 0, height: 0 });

  const fieldCue = useCue(progress, ENTRANCE.field);
  const markCue = useCue(progress, ENTRANCE.mark, Easing.out(Easing.back(2)));
  const rippleCue = useCue(progress, ENTRANCE.ripple);
  const nameCue = useCue(progress, ENTRANCE.name);
  const addressCue = useCue(progress, ENTRANCE.address);
  const factsCue = useCue(progress, ENTRANCE.facts);

  const fill = claimFill(claim);
  const swell = claimSwell(claim);

  const rise = (cue: Animated.AnimatedInterpolation<number>, from: number) => ({
    opacity: cue,
    transform: [
      { translateY: cue.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
    ],
  });

  const backdrop = heroBackdrop({ cover_url: coverUrl });
  const isPhoto = backdrop.kind === 'photo';
  const initials = shopInitials(name);
  const stats = storeStats(reputation, cheapest, serviceCount);

  const fieldEntrance = {
    opacity: fieldCue,
    transform: [{ scale: fieldCue.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }],
  };

  return (
    <View style={styles.hero}>
      <View
        style={[styles.cover, { height: COVER_HEIGHT + insetTop }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setField((current) =>
            current.width === width && current.height === height ? current : { width, height }
          );
        }}
      >
        {field.width > 0 && (
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, fieldEntrance]}>
            {isPhoto ? (
              <Image
                source={{ uri: backdrop.uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
                accessibilityLabel={`Photo of ${name}`}
              />
            ) : null}
            <Svg
              style={StyleSheet.absoluteFill}
              width={field.width}
              height={field.height}
              pointerEvents="none"
            >
              <Defs>
                {isPhoto ? (
                  // Only the top is shaded, for the chevron and the clock. No
                  // words sit on the photo any more, so the rest stays clear.
                  <SvgLinearGradient id="shopScrim" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0" stopColor={SCRIM} stopOpacity="0.45" />
                    <Stop offset="0.35" stopColor={SCRIM} stopOpacity="0" />
                  </SvgLinearGradient>
                ) : (
                  // Lower left to upper right, so the light falls from above.
                  <SvgLinearGradient id="shopScrim" x1="0" y1="1" x2="1" y2="0">
                    <Stop offset="0" stopColor={HERO_GRADIENT[0]} />
                    <Stop offset="0.55" stopColor={HERO_GRADIENT[1]} />
                    <Stop offset="1" stopColor={HERO_GRADIENT[2]} />
                  </SvgLinearGradient>
                )}
              </Defs>
              <Rect x={0} y={0} width={field.width} height={field.height} fill="url(#shopScrim)" />
            </Svg>
          </Animated.View>
        )}

        {/* The wash line is the splash's motif on the field; across a photograph
            it would read as a scratch. */}
        {!isPhoto && <WashLine progress={progress} width={field.width} height={field.height} />}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to shops"
          onPress={onBack}
          hitSlop={12}
          style={({ pressed }) => [
            styles.back,
            { top: insetTop + space.snug },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.onAccent} />
        </Pressable>
      </View>

      <View style={styles.storeCard}>
        <View style={styles.identityRow}>
          <View style={styles.markStage}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ripple,
                {
                  borderColor: accent.ink,
                  opacity: rippleCue.interpolate({
                    inputRange: [0, 0.15, 1],
                    outputRange: [0, 0.5, 0],
                  }),
                  transform: [
                    { scale: rippleCue.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.8] }) },
                  ],
                },
              ]}
            />
            {isClaiming && (
              <ClaimRings claim={claim} rank={rank} color={accent.surface} size={MARK_SIZE} />
            )}
            <Animated.View
              style={[
                styles.heroMark,
                !logoUrl && { backgroundColor: accent.surface },
                {
                  opacity: markCue,
                  transform: [{ scale: Animated.multiply(markCue, swell) }],
                },
              ]}
            >
              {logoUrl ? (
                <Image
                  source={{ uri: logoUrl }}
                  style={styles.heroLogo}
                  contentFit="cover"
                  transition={150}
                  accessibilityLabel={`${name} logo`}
                />
              ) : (
                <Text style={[styles.heroInitials, { color: accent.ink }]}>{initials}</Text>
              )}
              {/* The shop's colour arriving over the mark. A whole coloured
                  layer rather than an animated text colour, because text colour
                  cannot run on the native driver. Over a logo it is a tint that
                  lets the logo through. */}
              {isClaiming && (
                <Animated.View
                  style={[
                    styles.markWash,
                    {
                      backgroundColor: accent.surface,
                      opacity: logoUrl ? Animated.multiply(fill, 0.55) : fill,
                    },
                  ]}
                >
                  {!logoUrl && (
                    <Text style={[styles.heroInitials, { color: accent.ink }]}>{initials}</Text>
                  )}
                </Animated.View>
              )}
            </Animated.View>
          </View>

          {/* The marketplace "Following" state: a connected shop says so in
              its own colour, where a stranger's shop shows the Connect button. */}
          {isRegistered && (
            <View style={[styles.yourShop, { backgroundColor: accent.surface }]}>
              <Ionicons name="checkmark-circle" size={14} color={accent.ink} />
              <Text style={[styles.yourShopText, { color: accent.ink }]}>Your shop</Text>
            </View>
          )}
        </View>

        <Animated.View style={[styles.names, rise(nameCue, 14)]}>
          <Text style={styles.heroName} accessibilityRole="header" numberOfLines={2}>
            {name}
          </Text>
          {tagline ? (
            <Text style={styles.heroTagline} numberOfLines={2}>
              {tagline}
            </Text>
          ) : null}
        </Animated.View>

        {address ? (
          <Animated.View style={[styles.addressRow, rise(addressCue, 10)]}>
            <Ionicons name="location-outline" size={15} color={colors.subtle} />
            <Text style={styles.heroAddress} numberOfLines={2}>
              {address}
            </Text>
          </Animated.View>
        ) : null}

        <Animated.View
          style={[styles.statStrip, rise(factsCue, 10)]}
          accessible
          accessibilityLabel={stats.map((stat) => `${stat.value} ${stat.label}`).join('. ')}
        >
          {stats.map((stat, index) => (
            <View key={stat.key} style={[styles.stat, index > 0 && styles.statDivided]}>
              <View style={styles.statValueRow}>
                {stat.hasStar ? <Ionicons name="star" size={15} color={STAR} /> : null}
                <Text style={styles.statValue}>{stat.value}</Text>
              </View>
              <Text style={styles.statLabel} numberOfLines={1}>
                {stat.label}
              </Text>
            </View>
          ))}
        </Animated.View>

        {!isRegistered && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Connect to ${name} to book`}
            accessibilityState={{ disabled: isConnecting }}
            onPress={onConnect}
            disabled={isConnecting}
            style={({ pressed }) => [styles.heroCta, (pressed || isConnecting) && { opacity: 0.85 }]}
          >
            <Text style={styles.heroCtaText}>
              {isConnecting ? 'Connecting…' : 'Connect to book'}
            </Text>
            {!isConnecting && <Ionicons name="arrow-forward" size={17} color={colors.onAccent} />}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Escapes the page gutter on three sides so the banner reaches every edge,
  // the same idiom the home hero uses.
  hero: {
    marginTop: -space.room,
    marginHorizontal: -space.room,
    marginBottom: space.snug,
  },
  cover: {
    overflow: 'hidden',
    // Soft bottom corners so the banner's edge matches the rounded card
    // sitting on it, instead of a hard crop behind a soft shape.
    borderBottomLeftRadius: COVER_RADIUS,
    borderBottomRightRadius: COVER_RADIUS,
    // The mid stop as a floor: while the photo loads, what shows is still blue.
    backgroundColor: HERO_GRADIENT[1],
  },
  // Navy at 45% rather than white at 18%: over a photograph the white wash
  // could land on a white wall and vanish.
  back: {
    position: 'absolute',
    left: space.cosy,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(4,32,63,0.45)',
  },
  storeCard: {
    marginTop: -CARD_OVERLAP,
    marginHorizontal: space.room,
    paddingHorizontal: space.room,
    paddingBottom: space.room,
    borderRadius: 20,
    backgroundColor: colors.card,
    gap: space.snug,
    ...elevation.lift,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  markStage: {
    marginTop: -MARK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    borderWidth: 2,
  },
  heroMark: {
    width: MARK_SIZE,
    height: MARK_SIZE,
    borderRadius: MARK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.card,
    borderWidth: 3,
    borderColor: colors.card,
    ...elevation.rest,
  },
  heroLogo: { width: '100%', height: '100%', borderRadius: MARK_SIZE / 2 },
  markWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: MARK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInitials: { ...type.value },
  yourShop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    marginTop: space.cosy,
    paddingHorizontal: space.snug + 2,
    paddingVertical: space.tight,
    borderRadius: 999,
  },
  yourShopText: { ...type.caption, fontFamily: type.label.fontFamily },
  names: { gap: 2 },
  heroName: { ...type.value, color: colors.text },
  heroTagline: { ...type.label, color: colors.subtle },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.tight,
  },
  heroAddress: { ...type.caption, color: colors.subtle, flex: 1, marginTop: 1 },
  statStrip: {
    flexDirection: 'row',
    marginTop: space.tight,
    paddingTop: space.cosy,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivided: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.border,
  },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: space.tight },
  statValue: { ...type.section, color: colors.text },
  statLabel: { ...type.caption, color: colors.subtle },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
    marginTop: space.snug,
    paddingVertical: space.cosy + 2,
    borderRadius: 999,
    backgroundColor: colors.action,
  },
  heroCtaText: { ...type.label, fontSize: 16, color: colors.onAccent },
});
