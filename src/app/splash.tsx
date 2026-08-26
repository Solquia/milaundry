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
import {
  SPLASH_MAX_MS,
  homeRouteForRole,
  shouldLeaveSplash,
} from '@/lib/domain/splash-gate';
import { markSplashSeen } from '@/lib/splash-state';

/**
 * The wash line.
 *
 * The app opens on deep water. The level rises until it cuts through the
 * wordmark, three crests drift across each other at their own speeds, and every
 * letter the water has taken turns foam-aqua — so the brand is revealed *by*
 * the wash rather than placed on top of it. Once the session is known the water
 * floods the screen and the handover happens underneath it.
 *
 * Two mechanics carry the whole screen:
 *
 * 1. **The reveal.** One mark is drawn dry on the field. A second, foam-toned
 *    copy lives inside the water's clip, counter-translated by the exact water
 *    offset — so it holds still on screen while its container moves, and the
 *    clip edge *is* the waterline. No masking library, no per-frame layout.
 * 2. **The seam.** Each crest is a path spanning two screen widths at a whole
 *    number of periods, translated exactly one width per loop. Sliding by one
 *    width lands on an identical crest, so the loop cannot show a seam.
 *
 * Everything animated here drives `transform` or `opacity` only, so all of it
 * runs on the native driver: no per-frame work crosses the bridge.
 */

/** Deepened brand field — the blue the rest of the app uses, at full strength. */
const FIELD = ['#04203F', '#0B4A8C', '#1B76CE'] as const;
/** Foam. The one colour the splash adds, and it only ever touches water. */
const FOAM = '#7FF3D6';
/** Submerged secondary text: foam-white, kept light enough to read on water. */
const FOAM_TEXT = '#D9FFF7';

const RISE_MS = 1500;
const FLOOD_MS = 460;
/** Where the water rests, as a fraction of screen height from the top. */
const REST_LEVEL = 0.52;

/** The wordmark straddles the waterline: this much of it sits above the line. */
const MARK_ABOVE_LINE = 38;
const MARK_HEIGHT = 92;

/** `periods` must be a whole number, or the one-width loop shift would seam. */
const CRESTS = [
  { key: 'far', amplitude: 12, periods: 3, duration: 9000, opacity: 0.28, lift: 30 },
  { key: 'mid', amplitude: 17, periods: 2, duration: 6200, opacity: 0.5, lift: 14 },
  { key: 'near', amplitude: 22, periods: 1, duration: 4200, opacity: 1, lift: 0 },
] as const;

const BUBBLES = [
  { key: 'a', x: 0.16, size: 9, delay: 0, duration: 5200, drift: 14 },
  { key: 'b', x: 0.31, size: 5, delay: 900, duration: 4200, drift: -10 },
  { key: 'c', x: 0.46, size: 12, delay: 400, duration: 6200, drift: 8 },
  { key: 'd', x: 0.62, size: 6, delay: 1600, duration: 4800, drift: -16 },
  { key: 'e', x: 0.74, size: 8, delay: 2400, duration: 5600, drift: 12 },
  { key: 'f', x: 0.88, size: 4, delay: 1200, duration: 3800, drift: -8 },
  { key: 'g', x: 0.24, size: 6, delay: 3000, duration: 5000, drift: 10 },
  { key: 'h', x: 0.55, size: 4, delay: 2000, duration: 4400, drift: -12 },
] as const;

/**
 * A seamless wave spanning two screen widths, with `periods * 2` full periods
 * across it and a filled body hanging below the trough.
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

  // 1 = a screen below the resting line, 0 = resting, -1 = flooded past the top.
  const [sink] = useState(() => new Animated.Value(1));
  const [markIn] = useState(() => new Animated.Value(0));
  const [breath] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let isActive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (isActive) setIsReduceMotion(enabled);
    });
    return () => {
      isActive = false;
    };
  }, []);

  // The one authored moment: the water arriving. Everything else is its
  // secondary motion.
  useEffect(() => {
    if (isReduceMotion) {
      sink.setValue(0);
      markIn.setValue(1);
      return;
    }

    Animated.parallel([
      Animated.timing(sink, {
        toValue: 0,
        duration: RISE_MS,
        // Exponential ease-out: the water arrives fast and settles, the way a
        // filling drum does.
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      Animated.timing(markIn, {
        toValue: 1,
        duration: 900,
        delay: 120,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    const bob = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    bob.start();
    return () => bob.stop();
  }, [isReduceMotion, sink, markIn, breath]);

  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, []);

  const restY = height * REST_LEVEL;

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

    // The flood: the water takes the screen, and the handover lands under it.
    Animated.timing(sink, {
      toValue: -1,
      duration: FLOOD_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(go);
  }, [router, session, profile?.role, sink, isReduceMotion]);

  useEffect(() => {
    if (shouldLeaveSplash({ elapsedMs, isAuthLoading: isLoading })) leave();
  }, [elapsedMs, isLoading, leave]);

  const isWaitingOnSession = isLoading && elapsedMs < SPLASH_MAX_MS;

  // One value drives the body, the crests and the reveal together.
  const waterY = Animated.add(
    sink.interpolate({
      inputRange: [-1, 0, 1],
      outputRange: [-restY - MARK_HEIGHT, 0, height],
    }),
    breath.interpolate({ inputRange: [0, 1], outputRange: [0, -7] })
  );

  const markRise = markIn.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

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

      {/* The field the water sits in. */}
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id="field" x1="0" y1="0" x2="0.55" y2="1">
            <Stop offset="0" stopColor={FIELD[0]} />
            <Stop offset="0.6" stopColor={FIELD[1]} />
            <Stop offset="1" stopColor={FIELD[2]} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#field)" />
      </Svg>

      {/* The dry mark, drawn on the field. The water occludes its lower part. */}
      <Animated.View
        style={[
          styles.markLayer,
          { top: restY - MARK_ABOVE_LINE },
          { opacity: markIn, transform: [{ translateY: markRise }] },
        ]}
        pointerEvents="none"
      >
        <Mark tone="#FFFFFF" taglineTone="#A8CFF2" />
      </Animated.View>

      {/* The water. Its top edge is the waterline; the crests break above it. */}
      <Animated.View
        style={[
          styles.water,
          { top: restY, height: height + MARK_HEIGHT },
          { transform: [{ translateY: waterY }] },
        ]}
        pointerEvents="none"
      >
        {CRESTS.map((crest) => (
          <Crest key={crest.key} width={width} crest={crest} isStill={isReduceMotion} />
        ))}

        {/* Everything below the line, clipped by the line itself. */}
        <View style={styles.clip}>
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
              depth={height - restY}
              isStill={isReduceMotion}
            />
          ))}

          {/* The submerged copy: pinned to the dry mark's screen position by
              cancelling the water's own offset, so the clip edge does the
              revealing. */}
          <Animated.View
            style={[
              styles.submerged,
              { top: -MARK_ABOVE_LINE },
              {
                opacity: markIn,
                transform: [
                  {
                    translateY: Animated.add(
                      Animated.multiply(waterY, -1),
                      markRise
                    ),
                  },
                ],
              },
            ]}
          >
            <Mark tone={FOAM} taglineTone={FOAM_TEXT} />
          </Animated.View>
        </View>
      </Animated.View>

      <View style={styles.foot}>
        <Text style={styles.footText}>
          {isWaitingOnSession ? 'Filling the drum…' : 'Tap to continue'}
        </Text>
      </View>
    </Pressable>
  );
}

function Mark({ tone, taglineTone }: { tone: string; taglineTone: string }) {
  return (
    <View style={styles.mark}>
      <Text style={[styles.wordmark, { color: tone }]}>MiLaundry</Text>
      <Text style={[styles.tagline, { color: taglineTone }]}>
        Fresh clothes, handled for you
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
          top: -(crest.amplitude * 2 + crest.lift),
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
          fill={crest.key === 'near' ? '#0E5FA8' : '#1B76CE'}
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
  /** Visible water depth below the line, so suds rise through it and not past. */
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
        delay: bubble.delay,
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
            inputRange: [0, 0.15, 0.75, 1],
            outputRange: [0, 0.45, 0.28, 0],
          }),
          transform: [
            {
              // Up through the water and out at the surface, where the crest
              // stroke takes over.
              translateY: rise.interpolate({
                inputRange: [0, 1],
                outputRange: [depth * 0.92, 4],
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
  screen: { flex: 1, backgroundColor: FIELD[0] },
  markLayer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  mark: { alignItems: 'center', gap: 10 },
  wordmark: {
    ...type.hero,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -1.4,
  },
  tagline: { ...type.body, letterSpacing: 0.2 },
  water: { position: 'absolute', left: 0, right: 0 },
  crest: { position: 'absolute', left: 0 },
  clip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  submerged: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  // Anchored to the waterline (the clip's top edge), not the container bottom,
  // which sits a screen below the phone.
  bubble: { position: 'absolute', top: 0, backgroundColor: FOAM },
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 52,
    alignItems: 'center',
  },
  footText: { ...type.caption, color: '#8FBFEC', letterSpacing: 0.6 },
});
