/**
 * The spotlight's offers: rounded deal cards in the shop's colour, each with
 * its product shot in a circle on the right — the "Big Flavor. Bigger Deals."
 * card McDonald's opens on, with the next card peeking so it reads as a row.
 *
 * Every offer is one the shop can stand behind (`domain/spotlight`). The row
 * turns by itself, stops for good once a thumb has swiped it, and never moves
 * under Reduce Motion. Each card's button does one real thing.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { ServicePhoto } from './service-photo';
import { ACCENTS, RADII, colors, elevation, space, type } from './ui-kit';
import type { SpotlightBanner } from '@/lib/domain/spotlight';
import { useReducedMotion } from '@/lib/use-reduced-motion';
import { fontFor } from '@/lib/domain/design-scale';

type Accent = (typeof ACCENTS)[number];

/** Long enough to read a headline and a line, short enough to feel alive. */
const TURN_MS = 5200;
const CARD_HEIGHT = 180;
const GAP = space.cosy;
/** How much of the next card shows, so the row says it scrolls. */
const PEEK = 28;

interface SpotlightPromosProps {
  banners: readonly SpotlightBanner[];
  accent: Accent;
  onAction: (banner: SpotlightBanner) => void;
}

export function SpotlightPromos({ banners, accent, onAction }: SpotlightPromosProps) {
  const isReduced = useReducedMotion();
  const scroller = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const [isHeld, setIsHeld] = useState(false);
  const count = banners.length;
  const cardWidth = count > 1 ? Math.max(0, width - PEEK - GAP) : width;
  const step = cardWidth + GAP;

  useEffect(() => {
    if (isReduced || isHeld || count < 2 || step <= GAP) return;
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % count;
        scroller.current?.scrollTo({ x: next * step, animated: true });
        return next;
      });
    }, TURN_MS);
    return () => clearInterval(timer);
  }, [isReduced, isHeld, count, step]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (step <= GAP) return;
    const page = Math.round(event.nativeEvent.contentOffset.x / step);
    if (page !== index && page >= 0 && page < count) setIndex(page);
  };

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.wrap}>
      {width > 0 ? (
        <ScrollView
          ref={scroller}
          horizontal
          snapToInterval={step}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          onScrollBeginDrag={() => setIsHeld(true)}
          contentContainerStyle={{ gap: GAP }}
          accessibilityLabel={`Offers, ${index + 1} of ${count}`}
        >
          {banners.map((banner) => (
            <PromoCard
              key={banner.key}
              banner={banner}
              accent={accent}
              width={cardWidth}
              onPress={() => onAction(banner)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={{ height: CARD_HEIGHT }} />
      )}
      {count > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {banners.map((banner, dot) => (
            <View
              key={banner.key}
              style={[styles.dot, dot === index && [styles.dotOn, { backgroundColor: accent.ink }]]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

interface PromoCardProps {
  banner: SpotlightBanner;
  accent: Accent;
  width: number;
  onPress: () => void;
}

function PromoCard({ banner, accent, width, onPress }: PromoCardProps) {
  return (
    <View style={[styles.card, elevation.lift, { width, backgroundColor: accent.ink }]}>
      {/* Two soft rings behind the photo, the way a poster frames its product. */}
      <View style={[styles.halo, styles.haloOuter]} />
      <View style={[styles.halo, styles.haloInner]} />
      <ServicePhoto photo={banner.photo} style={[styles.photo, { backgroundColor: accent.surface }]} />

      <View style={styles.copy}>
        <View style={styles.kicker}>
          <Ionicons name="flash" size={11} color={colors.onAccent} />
          <Text style={styles.kickerText} numberOfLines={1}>
            {banner.kicker}
          </Text>
        </View>
        <Text style={styles.headline} numberOfLines={2} accessibilityRole="header">
          {banner.headline}
        </Text>
        <Text style={styles.detail} numberOfLines={2}>
          {banner.detail}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${banner.cta}: ${banner.headline}`}
          onPress={onPress}
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <Text style={[styles.ctaText, { color: accent.ink }]}>{banner.cta}</Text>
          <View style={[styles.ctaArrow, { backgroundColor: accent.ink }]}>
            <Ionicons name="arrow-forward" size={12} color={colors.onAccent} />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const PHOTO = 132;

const styles = StyleSheet.create({
  wrap: { gap: space.snug },
  card: { height: CARD_HEIGHT, borderRadius: RADII.card, borderCurve: 'continuous', overflow: 'hidden' },
  // The rings once drawn behind the photo are retired: the banner is the
  // shop's colour and its picture, nothing laid over for effect.
  halo: { display: 'none' },
  haloOuter: { width: 230, height: 230, right: -70, top: -25 },
  haloInner: { width: 176, height: 176, right: -42, top: 2 },
  photo: {
    position: 'absolute',
    right: -6,
    top: (CARD_HEIGHT - PHOTO) / 2,
    width: PHOTO,
    height: PHOTO,
    borderRadius: RADII.card - 4,
    borderCurve: 'continuous',
  },
  copy: {
    flex: 1,
    justifyContent: 'center',
    gap: 5,
    paddingLeft: space.room + 2,
    paddingRight: PHOTO + space.tight,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  kickerText: {
    ...type.caption,
    fontSize: 12,
    ...fontFor(600),
    letterSpacing: 0,
    color: colors.onAccent,
  },
  headline: { ...type.section, fontSize: 22, lineHeight: 26, letterSpacing: -0.5, color: colors.onAccent },
  detail: { ...type.caption, color: 'rgba(255,255,255,0.85)' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.snug,
    marginTop: 4,
    paddingLeft: space.cosy + 2,
    paddingRight: 5,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  ctaText: { fontSize: 15, lineHeight: 20, letterSpacing: -0.2, ...fontFor(700) },
  ctaArrow: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: 'rgba(60, 60, 67, 0.3)' },
  dotOn: { backgroundColor: colors.text },
});
