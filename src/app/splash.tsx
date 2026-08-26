import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
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
 * The water rises until it cuts through the wordmark; every letter it has taken
 * reads foam-aqua. Three crests drift across each other at the surface, suds
 * climb through the body, and on handover the water floods the screen.
 *
 * ## Why the layers are built the way they are
 *
 * React Native clips differently on Android than on iOS, and both differences
 * bite this composition:
 *
 * - **Children outside a parent's bounds are clipped away on Android.** The
 *   crests break *above* the waterline, so they cannot be children of the water
 *   body. They live in their own band whose box already contains the headroom
 *   they need.
 * - **Transformed children are not reliably clipped by `overflow: hidden` on
 *   Android.** So the reveal cannot be a transformed copy inside a clip — it
 *   paints straight over the dry mark instead. Here the water body is a
 *   bottom-anchored box whose *height* animates, and the foam copy sits at a
 *   fixed distance from the screen bottom with no transform at all. The box's
 *   growing top edge is the waterline, and it does the revealing.
 *
 * Animating height means that one value runs on the JS driver. Its partner —
 * the crest band, which only ever translates — runs on the native driver, and
 * the two are started in the same `parallel` with identical timing so they
 * stay in register. One Animated.Value cannot serve both drivers, which is why
 * there are two.
 */

/** Deep field. No bright blue survives anywhere the water does not cover. */
const FIELD = ['#0A3E75', '#062F5C', '#04203F'] as const;
/** Foam — the one colour added, and it only ever touches water. */
const FOAM = '#7FF3D6';
const FOAM_TEXT = '#D9FFF7';

const RISE_MS = 2600;
const FLOOD_MS = 620;
const REST_LEVEL = 0.52;

/** How much of the lockup sits above the waterline. */
const MARK_ABOVE_LINE = 40;
/** Wordmark 56 + rule block 33 + caps 14. */
const MARK_HEIGHT = 103;

/** Room above the waterline for the tallest crest to break into. */
const CREST_HEADROOM = 60;
/** Tallest crest band: the largest amplitude times six. */
const CREST_BAND = 132;

/** `periods` must be whole, or the one-width loop shift would show a seam. */
const CRESTS = [
  { key: 'far', amplitude: 12, periods: 3, duration: 13000, opacity: 0.3, lift: 30 },
  { key: 'mid', amplitude: 17, periods: 2, duration: 9000, opacity: 0.55, lift: 14 },
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
 * the trough so the crest and the water read as one surface.
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
  const { width, height } = useWindowDimensions();

  const [elapsedMs, setElapsedMs] = useState(0);
  const [isReduceMotion, setIsReduceMotion] = useState(false);
  const hasLeftRef = useRef(false);

  // 1 = below the screen, 0 = resting waterline, -1 = flooded past the top.
  // Two values, one per driver — see the note at the top of the file.
  const [surfaceNative] = useState(() => new Animated.Value(1));
  const [surfaceLayout] = useState(() => new Animated.Value(1));
  const [markIn] = useState(() => new Animated.Value(0));

  const restY = height * REST_LEVEL;
  const depth = height - restY;

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
      surfaceNative.setValue(0);
      surfaceLayout.setValue(0);
      markIn.setValue(1);
      return;
    }

    const rise = (value: Animated.Value, useNativeDriver: boolean) =>
      Animated.timing(value, {
        toValue: 0,
        duration: RISE_MS,
        // Exponential ease-out: the water arrives fast and settles, the way a
        // filling drum does.
        easing: Easing.out(Easing.exp),
        useNativeDriver,
      });

    const run = Animated.parallel([
      rise(surfaceNative, true),
      rise(surfaceLayout, false),
      Animated.timing(markIn, {
        toValue: 1,
        duration: 1300,
        delay: 260,
        easing: Easing.out(Easing.cubic),
        // Opacity only. A transform here would break the reveal: Android does
        // not reliably clip transformed children.
        useNativeDriver: true,
      }),
    ]);
    run.start();
    return () => run.stop();
  }, [isReduceMotion, surfaceNative, surfaceLayout, markIn]);

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

    const flood = (value: Animated.Value, useNativeDriver: boolean) =>
      Animated.timing(value, {
        toValue: -1,
        duration: FLOOD_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver,
      });

    // The water takes the screen, and the handover lands under it.
    Animated.parallel([
      flood(surfaceNative, true),
      flood(surfaceLayout, false),
    ]).start(go);
  }, [router, session, profile?.role, surfaceNative, surfaceLayout, isReduceMotion]);

  useEffect(() => {
    if (shouldLeaveSplash({ elapsedMs, isAuthLoading: isLoading })) leave();
  }, [elapsedMs, isLoading, leave]);

  const markTop = restY - MARK_ABOVE_LINE;

  // The crest band rides the surface; the body grows up to meet it.
  const crestShift = surfaceNative.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-(restY + CREST_HEADROOM + 80), 0, depth + CREST_HEADROOM],
  });
  const bodyHeight = surfaceLayout.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [height + 80, depth, 0],
  });

  return (
    <Pressable
      style={styles.screen}
      accessibilityRole="button"
      accessibilityLabel="Continue to MiLaundry"
      onPress={() => {
        if (!isLoading) leave();
      }}
    >
      <StatusBar style="light" />

      {/* The field. Deep at every stop, so nothing bright shows before the
          water arrives. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id="field" x1="0" y1="0" x2="0.5" y2="1">
            <Stop offset="0" stopColor={FIELD[0]} />
            <Stop offset="0.55" stopColor={FIELD[1]} />
            <Stop offset="1" stopColor={FIELD[2]} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#field)" />
      </Svg>

      {/* The dry mark, on the field. The water paints over its lower part. */}
      <Animated.View
        style={[styles.markLayer, { top: markTop }, { opacity: markIn }]}
        pointerEvents="none"
      >
        <Mark tone="#FFFFFF" taglineTone="#A8CFF2" />
      </Animated.View>

      {/* The body: bottom-anchored, and its growing top edge is the waterline.
          Nothing inside it is transformed except the suds, which are held below
          the edge by their travel distance. */}
      <Animated.View
        style={[styles.body, { height: bodyHeight }]}
        pointerEvents="none"
      >
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <SvgLinearGradient id="body" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#0E5FA8" />
              <Stop offset="1" stopColor="#04203F" />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#body)" />
        </Svg>

        {BUBBLES.map((bubble) => (
          <Bubble
            key={bubble.key}
            bubble={bubble}
            width={width}
            depth={depth}
            isStill={isReduceMotion}
          />
        ))}

        {/* The foam copy: fixed to the screen bottom, so it holds still while
            the box grows past it. No transform — the clip must be trusted. */}
        <Animated.View
          style={[
            styles.submerged,
            { bottom: height - markTop - MARK_HEIGHT },
            { opacity: markIn },
          ]}
        >
          <Mark tone={FOAM} taglineTone={FOAM_TEXT} />
        </Animated.View>
      </Animated.View>

      {/* The surface, in its own band with the headroom its crests need. */}
      <Animated.View
        style={[
          styles.crestBand,
          { top: restY - CREST_HEADROOM },
          { transform: [{ translateY: crestShift }] },
        ]}
        pointerEvents="none"
      >
        {CRESTS.map((crest) => (
          <Crest key={crest.key} width={width} crest={crest} isStill={isReduceMotion} />
        ))}
      </Animated.View>
    </Pressable>
  );
}

/**
 * The lockup: a display wordmark set tight, a hairline, and the tagline in
 * tracked caps. Both copies share these metrics exactly — only the tones
 * differ, or the foam copy would fall out of register with the dry one.
 */
function Mark({ tone, taglineTone }: { tone: string; taglineTone: string }) {
  return (
    <View style={styles.mark}>
      <Text style={[styles.wordmark, { color: tone }]}>MiLaundry</Text>
      <View style={[styles.rule, { backgroundColor: taglineTone }]} />
      <Text style={[styles.tagline, { color: taglineTone }]}>
        FRESH CLOTHES, HANDLED FOR YOU
      </Text>
    </View>
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
  // sliding as one sheet — and each loop shift is exactly one screen width.
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
          // Positioned inside the band's own headroom, never outside it:
          // Android would clip an out-of-bounds child away entirely.
          top: CREST_HEADROOM - (crest.amplitude * 2 + crest.lift),
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
          fill={crest.key === 'near' ? '#0E5FA8' : '#1568B8'}
        />
        {crest.key === 'near' && (
          <Path
            d={crestPath(width, crest.amplitude, crest.periods)}
            fill="none"
            stroke={FOAM}
            strokeWidth={2}
            strokeOpacity={0.85}
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
  /** Water depth at rest — suds rise through it and stop short of the surface. */
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
        // Held back until the water has settled: while the body is still short,
        // a sud could travel past its top edge, and Android would not clip it.
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
          width: bubble.size,
          height: bubble.size,
          borderRadius: bubble.size / 2,
          opacity: rise.interpolate({
            inputRange: [0, 0.15, 0.8, 1],
            outputRange: [0, 0.45, 0.3, 0],
          }),
          transform: [
            {
              translateY: rise.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -depth * 0.88],
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
  mark: { alignItems: 'center' },
  wordmark: {
    ...type.hero,
    fontSize: 50,
    lineHeight: 56,
    // -0.032em: optical correction at display size, inside the tracking floor.
    letterSpacing: -1.6,
  },
  /** The pause that makes the tracked caps read as deliberate. */
  rule: { width: 40, height: 1, marginTop: 18, marginBottom: 14, opacity: 0.55 },
  tagline: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 3,
    lineHeight: 14,
  },
  body: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  submerged: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bubble: { position: 'absolute', bottom: 0, backgroundColor: FOAM },
  crestBand: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: CREST_HEADROOM + CREST_BAND,
  },
  crest: { position: 'absolute', left: 0 },
});
