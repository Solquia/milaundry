/**
 * The top of a shop's web page: the shop, in its own colour.
 *
 * This is the whole first screen on a phone, and for most customers it is the
 * only thing they see before deciding whether to scroll. So it is built to be
 * looked at rather than skimmed past.
 *
 * Three things carry it.
 *
 * **The sweep.** The block used to end in a 28px corner nub — at a glance a
 * rounded rectangle, which is what every card on the page already is. It ends
 * in a drawn arc now: the bottom edge leaves each side wall `layout.heroSweep`
 * up and curves to its lowest point at the centre, cut with an elliptical
 * radius rather than approximated with a corner. The foot pads the words clear
 * of it, so the curve is empty space the photograph gets to fill.
 *
 * **The facts as a rule, not as pills.** Three translucent capsules read as
 * chrome. The same three facts set in a row, divided by hairlines, read as a
 * plate on a building.
 *
 * **One authored entrance.** The photograph settles from a slow push-in while
 * the logo, name, tagline and facts rise in behind it on a single driver, then
 * the picture drifts for as long as the page is open. One moment, not four
 * effects — and none of it at all when the device has asked for less motion.
 */
import { Image } from 'expo-image';
import React from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

import { BlueField } from '@/components/blue-field';
import { ShopLogo } from '@/components/shop-logo';
import { BLUE_FIELD, colors, fontFor, space } from '@/components/ui-kit';
import { formatMoneyCompact } from '@/lib/domain/money';
import { heroBackdrop, shopLogoUri } from '@/lib/domain/shop-cover';
import type { WebLayout } from '@/lib/domain/web-layout';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { Greeting } from '@/lib/domain/home-greeting';
import type { StorefrontShop } from '@/lib/types';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * The photo darkens into the field's own deep cobalt, not into black: the
 * page is one blue, and a picture graded to navy would sit on it as a second.
 */
const SCRIM = BLUE_FIELD.deep;
/**
 * How much of the photograph survives the wash.
 *
 * The picture is evidence — this is the shop, these are its machines — but the
 * page is one blue, and a full-strength photograph made the top of it a
 * different world from everything under it. Held at this weight and laid over
 * the field, with a wash of the field's own mid-blue on top, the photo keeps
 * its shapes and gives up its colour to the page.
 */
const PHOTO_OPACITY = 0.5;
/** The blue laid back over the picture. */
const WASH_OPACITY = 0.55;
const LOGO_SIZE = 76;
/** The logo on a window with no height to spare. */
const LOGO_SIZE_TIGHT = 48;

/** The push-in the photograph settles from, and the drift it never stops. */
const PUSH_IN = 1.09;
const DRIFT = 1.05;
const DRIFT_MS = 16000;

interface StorefrontHeroProps {
  shop: StorefrontShop;
  theme: StorefrontTheme;
  reputationLabel: string | null;
  cheapest: number | null;
  serviceCount: number;
  /** "Hi Maria, here's what we wash." — see `domain/home-greeting`. */
  greeting: Greeting;
  /** The window this is being drawn in: how tall it stands, how wide it reads. */
  layout: WebLayout;
}

export function StorefrontHero({
  shop,
  theme,
  reputationLabel,
  cheapest,
  serviceCount,
  greeting,
  layout,
}: StorefrontHeroProps) {
  const backdrop = heroBackdrop(shop);
  const isReduced = useReducedMotion();
  const facts = [
    reputationLabel,
    cheapest !== null ? `from ${formatMoneyCompact(cheapest)}` : null,
    serviceCount > 0 ? `${serviceCount} ${serviceCount === 1 ? 'service' : 'services'}` : null,
  ].filter((fact): fact is string => fact !== null);

  /**
   * One driver for the whole entrance. Each element reads a different slice of
   * it, which is what makes the stagger a single curve rather than four
   * animations that have to be kept in time with each other.
   */
  const [enter] = React.useState(() => new Animated.Value(0));
  const [zoom] = React.useState(() => new Animated.Value(PUSH_IN));

  React.useEffect(() => {
    if (isReduced) {
      enter.setValue(1);
      zoom.setValue(1);
      return;
    }
    const entrance = Animated.parallel([
      Animated.timing(enter, {
        toValue: 1,
        duration: 1100,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(zoom, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    // The drift picks up where the push-in lands, on the same value, so the
    // picture never appears to stop and start again.
    const drift = Animated.loop(
      Animated.sequence([
        Animated.timing(zoom, {
          toValue: DRIFT,
          duration: DRIFT_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(zoom, {
          toValue: 1,
          duration: DRIFT_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    entrance.start(({ finished }) => {
      if (finished) drift.start();
    });
    return () => {
      entrance.stop();
      drift.stop();
    };
  }, [enter, zoom, isReduced]);

  /** Rise and fade, over a slice of the one curve. */
  const rise = (from: number, to: number) => ({
    opacity: enter.interpolate({ inputRange: [from, to], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      {
        translateY: enter.interpolate({
          inputRange: [from, to],
          outputRange: [18, 0],
          extrapolate: 'clamp',
        }),
      },
    ],
  });

  const logoSize = layout.isTight ? LOGO_SIZE_TIGHT : LOGO_SIZE;
  const sweep = layout.heroSweep;

  return (
    <View
      style={[
        styles.hero,
        {
          backgroundColor: BLUE_FIELD.deep,
          minHeight: layout.heroHeight,
          // The arc. An elliptical corner radius — half the block's width
          // across, `sweep` deep — on each bottom corner; the two meet at the
          // centre and read as one continuous curve rather than two corners.
          ...Platform.select({
            web: {
              borderBottomLeftRadius: `50% ${sweep}px`,
              borderBottomRightRadius: `50% ${sweep}px`,
            } as object,
            default: { borderBottomLeftRadius: sweep, borderBottomRightRadius: sweep },
          }),
        },
      ]}
    >
      {/* The living blue, under everything. A shop with no photograph gets it
          on its own, and is the better for it: a flat block of brand colour was
          the one part of this page that looked unfinished. */}
      <BlueField />

      {backdrop.kind === 'photo' ? (
        <>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { opacity: PHOTO_OPACITY, transform: [{ scale: zoom }] },
            ]}
          >
            <Image
              source={{ uri: backdrop.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel={`${shop.name} storefront`}
            />
          </Animated.View>
          {/*
            Four stops, not two. The picture is left almost clear through its
            upper third, then the scrim deepens under the words and deepens
            again at the very foot, so the lowest point of the arc still reads
            as an edge against the page it is cut into.
          */}
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <SvgLinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={SCRIM} stopOpacity="0.5" />
                <Stop offset="0.34" stopColor={SCRIM} stopOpacity="0.18" />
                <Stop offset="0.72" stopColor={SCRIM} stopOpacity="0.72" />
                <Stop offset="1" stopColor={SCRIM} stopOpacity="0.95" />
              </SvgLinearGradient>
            </Defs>
            {/* The wash first, flat across the whole picture, then the vertical
                scrim that carries the words. Two layers, two jobs: one makes
                the photograph blue, the other makes the type legible. */}
            <Rect width="100%" height="100%" fill={BLUE_FIELD.mid} opacity={WASH_OPACITY} />
            <Rect width="100%" height="100%" fill="url(#scrim)" />
          </Svg>
        </>
      ) : null}

      <View
        style={[
          styles.foot,
          { paddingHorizontal: layout.gutter, paddingBottom: sweep + space.room },
          layout.isTight && styles.footTight,
        ]}
      >
        <View style={[styles.footInner, { maxWidth: layout.contentWidth }]}>
          {/* The page greets whoever opened it before it introduces itself.
              One line, light, above the identity block rather than instead of
              it — the shop's name is still the heading. */}
          <Animated.Text style={[styles.greeting, rise(0, 0.4)]}>
            {/* The same emphasis the app's home makes, in the half of it that
                is safe here: the reader's name takes the weight. The app also
                tints the connector, but that line sits on a ground we choose;
                this one can sit over whatever photograph the shop uploaded,
                where a light tint cannot be held to 4.5:1 at 17px. */}
            Hi <Text style={styles.greetingName}>{greeting.name}</Text>, {greeting.line}
          </Animated.Text>

          <Animated.View
            style={[
              styles.logoRing,
              {
                borderRadius: logoSize / 2 + 4,
                marginBottom: layout.isTight ? space.snug : space.cosy,
              },
              rise(0, 0.45),
            ]}
          >
            <ShopLogo
              name={shop.name}
              logoUrl={shopLogoUri(shop)}
              size={logoSize}
              accent={{ surface: theme.brandSoft, ink: theme.brandInk }}
            />
          </Animated.View>

          <Animated.Text
            accessibilityRole="header"
            style={[styles.name, layout.isTight && styles.nameTight, rise(0.08, 0.6)]}
          >
            {shop.name}
          </Animated.Text>

          {shop.tagline ? (
            <Animated.Text
              numberOfLines={layout.isTight ? 1 : 2}
              style={[styles.tagline, rise(0.16, 0.72)]}
            >
              {shop.tagline}
            </Animated.Text>
          ) : null}

          {facts.length > 0 ? (
            <Animated.View style={[styles.facts, rise(0.26, 0.88)]}>
              {facts.map((fact, index) => (
                <React.Fragment key={fact}>
                  {index > 0 ? <View style={styles.factRule} /> : null}
                  <Text style={styles.fact}>{fact}</Text>
                </React.Fragment>
              ))}
            </Animated.View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { justifyContent: 'flex-end', overflow: 'hidden' },
  foot: { paddingTop: space.gulf, alignItems: 'center' },
  footTight: { paddingTop: space.cosy },
  /** The colour runs the width of the window; the words stay with the column. */
  footInner: { width: '100%' },
  logoRing: {
    alignSelf: 'flex-start',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  /**
   * The largest thing on the page, and tracked in hard.
   *
   * A shop name set at heading size is a label; set this large with the letters
   * pulled together it becomes the mark itself. The tracking floor is -0.04em,
   * and at 40px this sits just inside it.
   */
  /**
   * The greeting, a step under the name and held back in weight and opacity:
   * it is the page saying hello, not the page's title. Alignment follows the
   * identity block it sits over, which is left on every window this hero has.
   */
  greeting: {
    fontFamily: fontFor(500),
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: 0.1,
    color: 'rgba(255, 255, 255, 0.86)',
    alignSelf: 'flex-start',
    marginBottom: space.snug,
  },
  /** Full strength and full weight: the one word here that is the reader's. */
  greetingName: {
    fontFamily: fontFor(800),
    color: colors.onAccent,
  },
  name: {
    fontFamily: fontFor(800),
    fontSize: 40,
    lineHeight: 43,
    letterSpacing: -1.5,
    color: '#FFFFFF',
  },
  nameTight: { fontSize: 27, lineHeight: 30, letterSpacing: -0.9 },
  /**
   * Set small and opened right up. The shop wrote these words; at this size and
   * tracking they read as a line of engraving under the name rather than as a
   * second sentence competing with it.
   */
  tagline: {
    fontFamily: fontFor(600),
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.74)',
    marginTop: space.snug,
  },
  /**
   * The three facts as one plate, divided by hairlines.
   *
   * They were three translucent pills, which is the shape every piece of UI
   * chrome on the web already wears. A ruled row is quieter, says the same
   * thing, and is the detail that makes the block look set rather than
   * assembled.
   */
  facts: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: space.room,
  },
  fact: {
    fontFamily: fontFor(600),
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.1,
    color: 'rgba(255,255,255,0.95)',
  },
  factRule: {
    width: 1,
    height: 13,
    backgroundColor: 'rgba(255,255,255,0.34)',
    marginHorizontal: space.cosy,
  },
});
