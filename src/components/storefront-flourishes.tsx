/**
 * The small drawn things that make a shop's page feel like a shop.
 *
 * The storefront's lower half — what people said, where the shop is, the code
 * that connects to it — was four white rectangles of the same radius on the
 * same pale field, while the price grid above it had coloured grounds and a
 * drawn object on every tile. The staleness was not inside any one of those
 * boxes; it was that the page stopped having a face halfway down.
 *
 * These are the pieces that carry the face down: a viewfinder around the code
 * and a sweep of light along a filled bar. Drawn
 * the way `service-scene.tsx` draws — a lit plane, a turned-away plane, a
 * highlight on the leading edge — so they read as the same hand.
 */
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import type { StorefrontTheme } from '@/lib/domain/web-theme';
import { useReducedMotion } from '@/lib/use-reduced-motion';


/**
 * Marks a card as one that rises to meet the pointer.
 *
 * The travel and the shadow are in `lib/web-document.ts` rather than in an
 * Animated value: hover only exists where there is a pointer, CSS already knows
 * when one arrives and leaves, and a transition the compositor owns cannot drop
 * a frame behind React. Off the web this is an empty object.
 */
export const LIFT_MARK = Platform.select({
  web: { dataSet: { lift: true } },
  default: {},
}) as object;

const BRACKET = 26;
const BRACKET_WEIGHT = 3;
const BREATHE_MS = 2400;

/**
 * The viewfinder around the connect code.
 *
 * Deliberately four corners and not a scanning bar across the code: the whole
 * point of this square is that a phone camera reads it off the screen, and an
 * animated band travelling over it is exactly the thing that would stop one
 * from resolving. The brackets sit outside the quiet zone, breathe slowly, and
 * never touch a module of the code itself.
 */
export function ScannerFrame({ theme, size }: { theme: StorefrontTheme; size: number }) {
  const isReduced = useReducedMotion();
  const [breath] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isReduced) {
      breath.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: BREATHE_MS / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: BREATHE_MS / 2,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath, isReduced]);

  const corners = [
    { key: 'tl', style: { top: 0, left: 0 }, d: `M 0 ${BRACKET} V 0 H ${BRACKET}` },
    { key: 'tr', style: { top: 0, right: 0 }, d: `M 0 0 H ${BRACKET} V ${BRACKET}` },
    { key: 'bl', style: { bottom: 0, left: 0 }, d: `M 0 0 V ${BRACKET} H ${BRACKET}` },
    { key: 'br', style: { bottom: 0, right: 0 }, d: `M ${BRACKET} 0 V ${BRACKET} H 0` },
  ];

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.frame,
        { width: size, height: size },
        isReduced
          ? null
          : {
              opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
              transform: [
                { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) },
              ],
            },
      ]}
    >
      {corners.map((corner) => (
        <View key={corner.key} style={[styles.corner, corner.style]}>
          <Svg width={BRACKET} height={BRACKET}>
            <Path
              d={corner.d}
              stroke={theme.brand}
              strokeWidth={BRACKET_WEIGHT}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </Svg>
        </View>
      ))}
    </Animated.View>
  );
}

const SWEEP_MS = 1100;
const SWEEP_WIDTH = 46;

/**
 * A pass of light along a bar that has just filled.
 *
 * One pass, once, chasing the fill rather than looping under it: a bar that
 * shimmers forever is a loading skeleton, and this bar is not loading — it is
 * the answer. `width` is the bar's own, so the light stops where the fill does.
 */
export function LightSweep({ delay, width }: { delay: number; width: number }) {
  const isReduced = useReducedMotion();
  const [run] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isReduced || width <= 0) return;
    const animation = Animated.timing(run, {
      toValue: 1,
      duration: SWEEP_MS,
      delay: delay + 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, isReduced, run, width]);

  if (isReduced || width <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sweep,
        {
          opacity: run.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            {
              translateX: run.interpolate({
                inputRange: [0, 1],
                outputRange: [-SWEEP_WIDTH, width],
              }),
            },
            { skewX: '-18deg' },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  frame: { position: 'absolute' },
  corner: { position: 'absolute' },
  sweep: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SWEEP_WIDTH,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
});
