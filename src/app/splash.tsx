import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { type } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { homeRouteForRole, shouldLeaveSplash } from '@/lib/domain/splash-gate';
import { markSplashSeen } from '@/lib/splash-state';

/**
 * The wash line.
 *
 * The lockup sits on a deep field. Water rises until its crests lap just under
 * the tagline, three of them drifting across each other, suds climbing through
 * the body. When the session is known the water floods up over the mark and the
 * handover lands under it.
 *
 * ## Two rules this screen is built around, both learned the hard way
 *
 * **Nothing is clipped, and nothing sits outside its parent.** React Native
 * clips in opposite directions on the two platforms — Android drops children
 * that overflow a parent's bounds, and fails to clip transformed children under
 * `overflow: hidden`. A composition that depends on either behaviour renders
 * differently on every device. So the water is one layer, tall enough to hold
 * its own crests, moved only by `translateY`; every child sits inside it.
 *
 * **The screen measures itself.** `useWindowDimensions()` reports the window,
 * which on Android excludes the navigation bar the view actually draws behind.
 * Laying out against it put the water a nav-bar's height away from where the
 * crests were. `onLayout` reports the box this screen really occupies, and
 * every position derives from that one number.
 *
 * Everything animated drives `transform` or `opacity`, so all of it runs on the
 * native driver: no per-frame work crosses the bridge.
 */

/** The field. Lifted off near-black so the screen reads as water, not void. */
const FIELD = ['#12558F', '#0C3E6E', '#082B4D'] as const;
/** The body, top to bottom. */
const BODY = ['#2B8FE0', '#0C4F92'] as const;
/** Foam — the one colour added, and it only ever touches water. */
const FOAM = '#8CF6DC';

const RISE_MS = 2600;
const FLOOD_MS = 640;

/** Where the mark centres, and where the water rests, as fractions of height. */
const MARK_LEVEL = 0.42;
const REST_LEVEL = 0.6;

/** Room at the top of the water layer for its crests to break into. */
const HEADROOM = 70;

/** `periods` must be whole, or the one-width loop shift would show a seam. */
const CRESTS = [
  { key: 'far', amplitude: 12, periods: 3, duration: 13000, opacity: 0.3, lift: 34 },
  { key: 'mid', amplitude: 17, periods: 2, duration: 9000, opacity: 0.55, lift: 16 },
  { key: 'near', amplitude: 22, periods: 1, duration: 6200, opacity: 1, lift: 0 },
] as const;

const BUBBLES = [
  { key: 'a', x: 0.16, size: 9, delay: 0, duration: 7200, drift: 14 },
  { key: 'b', x: 0.31, size: 5, delay: 1200, duration: 6000, drift: -10 },
  { key: 'c', x: 0.46, size: 12, delay: 600, duration: 8600, drift: 8 },
  { key: 'd', x: 0.62, size: 6, delay: 2200, duration: 6600, drift: -16 },
  { key: 'e', x: 0.74, size: 8, delay: 3200, duration: 7800, drift: 12 },
  { key: 'f', x: 0.88, size: 4, delay: 1600, duration: 5400, drift: -8 },
  { key: 'g', x: 0.24, size: 6, delay: 4000, duration: 6900, drift: 10 },
  { key: 'h', x: 0.55, size: 4, delay: 2600, duration: 6200, drift: -12 },
] as const;

/**
 * A seamless wave spanning two screen widths, with a filled body hanging below
 * the trough so crest and water read as one surface.
 */
function crestPath(width: number, amplitude: number, periods: number): string {
  const period = width / periods;
  let d = `M 0 ${amplitude}`;
  for (let x = 0; x < width * 2; x += period) {
    d +=
      ` Q ${x + period * 0.25} 0 ${x + period * 0.5} ${amplitude}` +
      ` Q ${x + period * 0.75} ${amplitude * 2} ${x + period} ${amplitude}`;
  }
  return `${d} L ${width * 2} ${amplitude * 6} L 0 ${amplitude * 6} Z`;
}

export default function Splash() {
  const { session, profile, isLoading } = useAuth();
  const router = useRouter();
  const window = useWindowDimensions();

  // Seeded from the window so the first frame is composed, then corrected to
  // the box this screen actually occupies — which on Android includes the area
  // behind the navigation bar that the window measurement leaves out.
  const [box, setBox] = useState({ width: window.width, height: window.height });
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isReduceMotion, setIsReduceMotion] = useState(false);
  const hasLeftRef = useRef(false);

  // 1 = below the screen, 0 = resting waterline, -1 = flooded over the mark.
  const [surface] = useState(() => new Animated.Value(1));
  const [markIn] = useState(() => new Animated.Value(0));

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setBox((current) =>
      current.width === width && current.height === height
        ? current
        : { width, height }
    );
  }, []);

  useEffect(() => {
    let isActive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isActive) setIsReduceMotion(enabled);
    });
    return () => {
      isActive = false;
    };
  }, []);

  // The one authored moment: the water arriving.
  useEffect(() => {
    if (isReduceMotion) {
      surface.setValue(0);
      markIn.setValue(1);
      return;
    }

    const run = Animated.parallel([
      Animated.timing(surface, {
        toValue: 0,
        duration: RISE_MS,
        // Exponential ease-out: the water arrives fast and settles, the way a
        // filling drum does.
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(markIn, {
        toValue: 1,
        duration: 1300,
        delay: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    run.start();
    return () => run.stop();
  }, [isReduceMotion, surface, markIn]);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, []);

  const leave = useCallback(() => {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;
    markSplashSeen();

    const go = () =>
      router.replace(
        (session ? homeRouteForRole(profile?.role) : '/sign-in') as never
      );

    if (isReduceMotion) {
      go();
      return;
    }

    // The water takes the screen, and the handover lands under it.
    Animated.timing(surface, {
      toValue: -1,
      duration: FLOOD_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(go);
  }, [router, session, profile?.role, surface, isReduceMotion]);

  useEffect(() => {
    if (shouldLeaveSplash({ elapsedMs, isAuthLoading: isLoading })) leave();
  }, [elapsedMs, isLoading, leave]);

  const restY = box.height * REST_LEVEL;
  const depth = box.height - restY;

  // The water layer's own top edge. Its crests break into the headroom above
  // the waterline, so the layer is offset by exactly that much.
  const surfaceY = surface.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-(HEADROOM + 60), restY - HEADROOM, box.height],
  });

  return (
    <Pressable
      style={styles.screen}
      onLayout={onLayout}
      accessibilityRole="button"
      accessibilityLabel="Continue to MiLaundry"
      onPress={() => {
        if (!isLoading) leave();
      }}
    >
      <StatusBar style="light" />

      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id="field" x1="0" y1="0" x2="0.45" y2="1">
            <Stop offset="0" stopColor={FIELD[0]} />
            <Stop offset="0.55" stopColor={FIELD[1]} />
            <Stop offset="1" stopColor={FIELD[2]} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#field)" />
      </Svg>

      {/* The mark. The water floods over it on the way out. */}
      <Animated.View
        style={[
          styles.markLayer,
          { top: box.height * MARK_LEVEL },
          {
            opacity: markIn,
            transform: [
              {
                translateY: markIn.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none"
      >
        <Text style={styles.wordmark}>MiLaundry</Text>
        <View style={styles.rule} />
        <Text style={styles.tagline}>FRESH CLOTHES, HANDLED FOR YOU</Text>
      </Animated.View>

      {/* The water: one layer, tall enough to carry its own crests, moved only
          by translateY. Nothing here is clipped and nothing sits outside it. */}
      <Animated.View
        style={[
          styles.water,
          { height: box.height + HEADROOM },
          { transform: [{ translateY: surfaceY }] },
        ]}
        pointerEvents="none"
      >
        {/* The body, starting at the waterline and running past the bottom. */}
        <Svg
          style={[styles.body, { top: HEADROOM }]}
          width="100%"
          height={box.height}
        >
          <Defs>
            <SvgLinearGradient id="body" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={BODY[0]} />
              <Stop offset="1" stopColor={BODY[1]} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#body)" />
        </Svg>

        {CRESTS.map((crest) => (
          <Crest key={crest.key} width={box.width} crest={crest} isStill={isReduceMotion} />
        ))}

        {BUBBLES.map((bubble) => (
          <Bubble
            key={bubble.key}
            bubble={bubble}
            width={box.width}
            depth={depth}
            isStill={isReduceMotion}
          />
        ))}
      </Animated.View>
    </Pressable>
  );
}

function Crest({
  width,
  crest,
  isStill,
}: {
  width: number;
  crest: (typeof CRESTS)[number];
  isStill: boolean;
}) {
  // Each crest owns its clock, so the layers separate and recombine instead of
  // sliding as one sheet — and each loop shift is exactly one screen width,
  // which is why the path carries a whole number of periods.
  const [slide] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isStill) return;
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: crest.duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isStill, slide, crest.duration]);

  const band = crest.amplitude * 6;
  const shift = slide.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });

  return (
    <Animated.View
      style={[
        styles.crest,
        {
          // Inside the layer's own headroom — never above it.
          top: HEADROOM - (crest.amplitude * 2 + crest.lift),
          width: width * 2,
          height: band,
          opacity: crest.opacity,
          transform: isStill ? [] : [{ translateX: shift }],
        },
      ]}
    >
      <Svg width={width * 2} height={band}>
        <Path
          d={crestPath(width, crest.amplitude, crest.periods)}
          fill={crest.key === 'near' ? BODY[0] : '#1E7ACB'}
        />
        {crest.key === 'near' && (
          <Path
            d={crestPath(width, crest.amplitude, crest.periods)}
            fill="none"
            stroke={FOAM}
            strokeWidth={2}
            strokeOpacity={0.9}
          />
        )}
      </Svg>
    </Animated.View>
  );
}

function Bubble({
  bubble,
  width,
  depth,
  isStill,
}: {
  bubble: (typeof BUBBLES)[number];
  width: number;
  /** Visible water depth, so suds rise through it and stop under the surface. */
  depth: number;
  isStill: boolean;
}) {
  const [rise] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isStill) return;
    const loop = Animated.loop(
      Animated.timing(rise, {
        toValue: 1,
        duration: bubble.duration,
        // Held back until the water has settled, so none appears mid-air.
        delay: RISE_MS + bubble.delay,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isStill, rise, bubble.duration, bubble.delay]);

  if (isStill) return null;

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          left: width * bubble.x,
          // Anchored from the layer's top, which is where its bounds are known.
          top: HEADROOM + depth * 0.92,
          width: bubble.size,
          height: bubble.size,
          borderRadius: bubble.size / 2,
          opacity: rise.interpolate({
            inputRange: [0, 0.15, 0.8, 1],
            outputRange: [0, 0.5, 0.32, 0],
          }),
          transform: [
            {
              translateY: rise.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -depth * 0.86],
              }),
            },
            {
              translateX: rise.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [0, bubble.drift, 0],
              }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: FIELD[2] },
  markLayer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  wordmark: {
    ...type.hero,
    fontSize: 50,
    lineHeight: 56,
    color: '#FFFFFF',
    // -0.032em: optical correction at display size, inside the tracking floor.
    letterSpacing: -1.6,
  },
  /** The pause that makes the tracked caps read as deliberate. */
  rule: {
    width: 40,
    height: 1,
    marginTop: 18,
    marginBottom: 14,
    backgroundColor: '#BFDDF7',
    opacity: 0.6,
  },
  tagline: {
    fontSize: 10,
    fontWeight: '600',
    color: '#BFDDF7',
    letterSpacing: 3,
    lineHeight: 14,
  },
  water: { position: 'absolute', left: 0, right: 0, top: 0 },
  body: { position: 'absolute', left: 0, right: 0 },
  crest: { position: 'absolute', left: 0 },
  bubble: { position: 'absolute', backgroundColor: FOAM },
});
