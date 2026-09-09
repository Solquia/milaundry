/**
 * The shopfront's hero: the shop itself, with its name pinned to the foot.
 *
 * This used to be the app's blue field with the shop's initials centred on it,
 * the same for every laundry. What a customer walking past actually
 * recognises is the storefront, so when the shop has uploaded a photo of it
 * the photo takes the whole field and the name sits on a tag at the bottom,
 * the way a caption sits on a photograph. A shop with no photo keeps the
 * field, laid out the same way, so there is one composition rather than two.
 *
 * The mark is the shop's real logo now; it was initials on every customer
 * surface even when the merchant had uploaded one.
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

type Accent = (typeof ACCENTS)[number];

const HERO_RADIUS = 28;
/** The shop's mark in the hero, and the ring of water that leaves it. */
const MARK_SIZE = 64;
/** Room for the photo to be the point, before the safe-area inset is added. */
const HERO_MIN_HEIGHT = 300;
/** The app's deep navy, used for the scrim so the photo darkens into brand. */
const SCRIM = '#04203F';

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
  reputationLabel: string | null;
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

export function ShopfrontHero({
  name,
  tagline,
  address,
  logoUrl,
  coverUrl,
  isRegistered,
  accent,
  reputationLabel,
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

  const facts = [
    reputationLabel,
    cheapest === null ? null : `From ${formatMoneyCompact(cheapest)}`,
    serviceCount === 0
      ? null
      : `${serviceCount} ${serviceCount === 1 ? 'service' : 'services'}`,
  ].filter((fact): fact is string => fact !== null);

  const fieldEntrance = {
    opacity: fieldCue,
    transform: [{ scale: fieldCue.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) }],
  };

  return (
    <View
      style={[
        styles.hero,
        { paddingTop: insetTop + space.gulf, minHeight: HERO_MIN_HEIGHT + insetTop },
      ]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setField((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height }
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
                // Two scrims in one gradient: a light one at the top so the
                // chevron and the clock stay legible, a deep one at the foot
                // where the name and the facts sit. The middle stays clear
                // so the photo is the point.
                <SvgLinearGradient id="shopScrim" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={SCRIM} stopOpacity="0.4" />
                  <Stop offset="0.22" stopColor={SCRIM} stopOpacity="0" />
                  <Stop offset="0.5" stopColor={SCRIM} stopOpacity="0" />
                  <Stop offset="1" stopColor={SCRIM} stopOpacity="0.85" />
                </SvgLinearGradient>
              ) : (
                // Lower left to upper right, so the light falls from above the
                // way it does on a real surface and the depth pools underneath.
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

      {/* Everything that says who this is sits at the foot, like a caption. */}
      <View style={styles.identity}>
        <View style={styles.markStage}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ripple,
              {
                borderColor: isRegistered ? accent.surface : colors.onAccent,
                opacity: rippleCue.interpolate({
                  inputRange: [0, 0.15, 1],
                  outputRange: [0, 0.5, 0],
                }),
                transform: [
                  { scale: rippleCue.interpolate({ inputRange: [0, 1], outputRange: [0.9, 2.1] }) },
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
              isRegistered && !isClaiming && !logoUrl && { backgroundColor: accent.surface },
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
              <Text
                style={[
                  styles.heroInitials,
                  isRegistered && !isClaiming && { color: accent.ink },
                ]}
              >
                {initials}
              </Text>
            )}
            {/* The shop's colour arriving over the mark. A whole coloured
                layer rather than an animated text colour, because text colour
                cannot run on the native driver. Over a logo it is a tint that
                lets the logo through. */}
            {isClaiming && (
              <Animated.View
                style={[
                  styles.markWash,
                  { backgroundColor: accent.surface, opacity: logoUrl ? Animated.multiply(fill, 0.55) : fill },
                ]}
              >
                {!logoUrl && (
                  <Text style={[styles.heroInitials, { color: accent.ink }]}>{initials}</Text>
                )}
              </Animated.View>
            )}
          </Animated.View>
        </View>

        <Animated.View style={[styles.namePill, rise(nameCue, 18)]}>
          <Text style={styles.heroName} accessibilityRole="header" numberOfLines={2}>
            {name}
          </Text>
        </Animated.View>
        {tagline ? (
          <Animated.Text style={[styles.heroTagline, rise(addressCue, 14)]}>
            {tagline}
          </Animated.Text>
        ) : null}
        {address ? (
          <Animated.Text style={[styles.heroAddress, rise(addressCue, 14)]}>
            {address}
          </Animated.Text>
        ) : null}

        {facts.length > 0 && (
          <Animated.View
            style={[styles.factRow, rise(factsCue, 12)]}
            accessibilityLabel={facts.join('. ')}
          >
            {reputationLabel ? (
              <Ionicons name="star" size={13} color="#FFD25E" style={styles.factStar} />
            ) : null}
            {facts.map((fact, index) => (
              <React.Fragment key={fact}>
                {index > 0 && <Text style={styles.factDot}>·</Text>}
                <Text style={styles.factText}>{fact}</Text>
              </React.Fragment>
            ))}
          </Animated.View>
        )}

        {!isRegistered && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Connect to ${name} to book`}
            accessibilityState={{ disabled: isConnecting }}
            onPress={onConnect}
            disabled={isConnecting}
            style={({ pressed }) => [
              styles.heroCta,
              (pressed || isConnecting) && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.heroCtaText}>
              {isConnecting ? 'Connecting…' : 'Connect to book'}
            </Text>
            {!isConnecting && (
              <Ionicons name="arrow-forward" size={17} color={colors.actionInk} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Escapes the page gutter on three sides so the field reaches every edge,
  // the same idiom the home hero uses.
  hero: {
    marginTop: -space.room,
    marginHorizontal: -space.room,
    marginBottom: space.snug,
    paddingHorizontal: space.section,
    paddingBottom: space.section,
    borderBottomLeftRadius: HERO_RADIUS,
    borderBottomRightRadius: HERO_RADIUS,
    overflow: 'hidden',
    // The mid stop as a floor: while the photo loads, or if a rounded corner
    // antialiases past it, what shows through is still blue.
    backgroundColor: HERO_GRADIENT[1],
    ...elevation.hero,
  },
  identity: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-start',
    gap: space.tight,
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
  markStage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.snug,
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
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  heroLogo: { width: '100%', height: '100%' },
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
  heroInitials: { ...type.value, fontSize: 22, color: colors.onAccent },
  /** The tag the name sits on: a caption on the photo, not text floating over it. */
  namePill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: space.room,
    paddingVertical: space.snug,
    borderRadius: 999,
    backgroundColor: 'rgba(4,32,63,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroName: {
    ...type.hero,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: colors.onAccent,
  },
  heroTagline: {
    ...type.body,
    fontWeight: '600',
    color: colors.onAccent,
  },
  heroAddress: {
    ...type.body,
    color: colors.onAccent,
    opacity: 0.88,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.snug,
    marginTop: space.snug,
  },
  factStar: { marginRight: -2 },
  factText: { ...type.label, fontSize: 13, color: colors.onAccent },
  factDot: { ...type.label, fontSize: 13, color: colors.onAccent, opacity: 0.55 },
  heroCta: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    marginTop: space.room,
    paddingHorizontal: space.gulf,
    paddingVertical: space.cosy + 2,
    borderRadius: 999,
    backgroundColor: colors.card,
    ...elevation.lift,
  },
  heroCtaText: { ...type.label, fontSize: 16, color: colors.actionInk },
});