import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Defs,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { REVEAL_STAGGER_MS, Reveal } from '@/components/reveal';
import { HERO_GRADIENT, colors, elevation, space, type } from '@/components/ui-kit';
import { useHaptic } from '@/lib/use-app-settings';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * The front door.
 *
 * The splash hands over to this, not to a form. Someone opening MiLaundry for
 * the first time is almost always standing at a counter with a code in front
 * of them, so the scan is the one big control and everything else is the way
 * to *finish* it: sign in if you have an account, create one if you don't.
 * Owners get their own quiet line at the foot — they are one in a hundred
 * visitors, and they know who they are.
 *
 * Nothing is written on the water. The splash has just spent four seconds
 * saying the name, so repeating it here — wordmark, rule, tagline — would be
 * the app introducing itself twice to someone already holding a code. The
 * band is kept only for the handover: it opens on the same water the splash
 * closed on, the crests keep drifting, and everything a person has to read or
 * touch sits centred in the light below it, one column, in the middle of the
 * screen where a thumb already is.
 */

/** Long enough for the water to settle; short enough that the tiles never wait. */
const ARRIVE_MS = 560;
/** One pass of the viewfinder's line, and the rest between passes. */
const SWEEP_MS = 1500;
const SWEEP_REST_MS = 1900;
/** The water is a band now, not a field: enough to carry the crests, no more. */
const BAND_SHARE = 0.14;
const BAND_MIN = 120;
/** The sheet's top corners tuck this far up into the water. */
const SHEET_OVERLAP = 28;

/**
 * Same construction as the splash: whole periods across two widths, slid
 * exactly one width per loop, so the seam cannot show.
 */
const CRESTS = [
  { key: 'far', amplitude: 9, periods: 2, duration: 15000, opacity: 0.16, lift: 22 },
  { key: 'near', amplitude: 13, periods: 1, duration: 9500, opacity: 0.32, lift: 0 },
] as const;

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

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isReduced = useReducedMotion();
  const haptic = useHaptic();

  const [arrive] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isReduced) {
      arrive.setValue(1);
      return;
    }
    const animation = Animated.timing(arrive, {
      toValue: 1,
      duration: ARRIVE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [arrive, isReduced]);

  // The band carries no text, so it is the one box on this screen that may
  // keep a fixed height: nothing inside it can grow with the font scale.
  const bandHeight = insets.top + Math.max(BAND_MIN, Math.round(height * BAND_SHARE));

  const goScan = () => {
    haptic('commit');
    router.push('/scan-laundry' as never);
  };
  const goSignIn = () => {
    haptic('tap');
    router.push('/sign-in' as never);
  };
  const goSignUp = () => {
    haptic('tap');
    router.push('/sign-up' as never);
  };
  const goOwner = () => {
    haptic('tap');
    router.push({ pathname: '/sign-in', params: { as: 'owner' } } as never);
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        {/* The water ------------------------------------------------------ */}
        <Animated.View
          style={[
            styles.band,
            {
              height: bandHeight + SHEET_OVERLAP,
              transform: [
                {
                  scale: arrive.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1] }),
                },
              ],
            },
          ]}
        >
          <Svg width={width} height={bandHeight + SHEET_OVERLAP} style={StyleSheet.absoluteFill}>
            <Defs>
              <SvgLinearGradient id="welcomeBand" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0" stopColor={HERO_GRADIENT[0]} />
                <Stop offset="0.55" stopColor={HERO_GRADIENT[1]} />
                <Stop offset="1" stopColor={HERO_GRADIENT[2]} />
              </SvgLinearGradient>
            </Defs>
            <Rect width={width} height={bandHeight + SHEET_OVERLAP} fill="url(#welcomeBand)" />
          </Svg>

          {CRESTS.map((crest) => (
            <Crest
              key={crest.key}
              width={width}
              bottom={SHEET_OVERLAP + crest.lift}
              amplitude={crest.amplitude}
              periods={crest.periods}
              duration={crest.duration}
              opacity={crest.opacity}
              isReduced={isReduced}
            />
          ))}
        </Animated.View>

        {/* The sheet ------------------------------------------------------ */}
        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + space.section,
              opacity: arrive,
              transform: [
                {
                  translateY: arrive.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.lede} accessibilityRole="header">
            Your code is at the counter
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Scan your laundry's code"
            accessibilityHint="Opens the camera to connect to a laundry, then sign in or create an account"
            onPress={goScan}
            style={({ pressed }) => [styles.scanCard, pressed && styles.scanCardPressed]}
          >
            <Viewfinder isReduced={isReduced} />
            <View style={styles.scanCopy}>
              <Text style={styles.scanTitle}>Scan your laundry</Text>
              <Text style={styles.scanSub}>The fastest way in. We handle the rest.</Text>
            </View>
          </Pressable>

          <View style={styles.pair}>
            <Reveal delay={REVEAL_STAGGER_MS} style={styles.pairItem}>
              <PathTile
                icon="key-outline"
                title="Sign in"
                note="I have an account"
                onPress={goSignIn}
              />
            </Reveal>
            <Reveal delay={REVEAL_STAGGER_MS * 2} style={styles.pairItem}>
              <PathTile
                icon="person-add-outline"
                title="Create account"
                note="I'm new here"
                onPress={goSignUp}
              />
            </Reveal>
          </View>

          <Reveal delay={REVEAL_STAGGER_MS * 3} style={styles.ownerSlot}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Shop sign in, for laundry owners and staff"
              onPress={goOwner}
              style={({ pressed }) => [styles.ownerRow, pressed && styles.pressed]}
            >
              <Ionicons name="storefront-outline" size={16} color={colors.subtle} />
              <Text style={styles.ownerText}>
                Run a laundry? <Text style={styles.ownerLink}>Shop sign in</Text>
              </Text>
            </Pressable>
          </Reveal>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

/** One crest, drifting one screen-width per loop so it can never seam. */
function Crest({
  width,
  bottom,
  amplitude,
  periods,
  duration,
  opacity,
  isReduced,
}: {
  width: number;
  bottom: number;
  amplitude: number;
  periods: number;
  duration: number;
  opacity: number;
  isReduced: boolean;
}) {
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Reduced motion resolves a tick after mount, so the loop may already be
    // running: send the crest home rather than leaving it frozen mid-drift.
    if (isReduced) {
      drift.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(drift, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [drift, duration, isReduced]);

  const crestHeight = amplitude * 6;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.crest,
        {
          bottom,
          width: width * 2,
          height: crestHeight,
          opacity,
          transform: [
            { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) },
          ],
        },
      ]}
    >
      <Svg width={width * 2} height={crestHeight}>
        <Path d={crestPath(width, amplitude, periods)} fill={colors.onAccent} />
      </Svg>
    </Animated.View>
  );
}

/**
 * A viewfinder: four brackets around a code, and a line that reads it once
 * every few seconds. Drawn, not an icon, so the sweep can live inside it.
 */
function Viewfinder({ isReduced }: { isReduced: boolean }) {
  const [sweep] = useState(() => new Animated.Value(0));
  const size = 64;
  const inset = 10;
  const bracket = 14;
  const stroke = 2.5;

  useEffect(() => {
    if (isReduced) {
      sweep.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: SWEEP_MS,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(SWEEP_REST_MS),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sweep, isReduced]);

  const far = size - inset;
  const corners = [
    `M ${inset} ${inset + bracket} V ${inset} H ${inset + bracket}`,
    `M ${far - bracket} ${inset} H ${far} V ${inset + bracket}`,
    `M ${far} ${far - bracket} V ${far} H ${far - bracket}`,
    `M ${inset + bracket} ${far} H ${inset} V ${far - bracket}`,
  ];
  // A hint of a code between the brackets: enough to say "QR", not a real one.
  const cells = [
    [0, 0], [1, 0], [3, 0],
    [0, 1], [2, 1],
    [1, 2], [3, 2],
    [0, 3], [2, 3], [3, 3],
  ];
  const cell = 5;
  const gridOrigin = inset + bracket - 2;
  // The sweep travels the open span between the brackets. Its opacity gates it
  // off at both ends, so at rest the glyph is a still viewfinder rather than a
  // frozen beam.
  const travel = far - inset - stroke;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {corners.map((d) => (
          <Path
            key={d}
            d={d}
            stroke={colors.onAccent}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {cells.map(([x, y]) => (
          <Rect
            key={`${x}-${y}`}
            x={gridOrigin + x * (cell + 2)}
            y={gridOrigin + y * (cell + 2)}
            width={cell}
            height={cell}
            rx={1}
            fill={colors.onAccent}
            opacity={0.55}
          />
        ))}
        <Circle cx={size / 2} cy={size / 2} r={1.6} fill={colors.onAccent} opacity={0.9} />
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.sweep,
          {
            left: inset,
            right: inset,
            top: inset,
            opacity: sweep.interpolate({
              inputRange: [0, 0.08, 0.92, 1],
              outputRange: [0, 1, 1, 0],
            }),
            transform: [
              {
                translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

function PathTile({
  icon,
  title,
  note,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  note: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${note}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      <View style={styles.tileIcon}>
        <Ionicons name={icon} size={20} color={colors.actionInk} />
      </View>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileNote}>{note}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1 },

  band: {
    overflow: 'hidden',
    // The band scales around its own centre; the overscale hides its edges
    // under the screen's, so nothing pale shows at the corners.
    backgroundColor: HERO_GRADIENT[0],
  },
  crest: { position: 'absolute', left: 0 },

  sheet: {
    flexGrow: 1,
    // Everything a person reads or touches sits in the middle of what is left.
    justifyContent: 'center',
    marginTop: -SHEET_OVERLAP,
    borderTopLeftRadius: SHEET_OVERLAP,
    borderTopRightRadius: SHEET_OVERLAP,
    backgroundColor: colors.bg,
    paddingHorizontal: space.room,
    paddingTop: space.section,
  },

  lede: {
    ...type.title,
    color: colors.text,
    textAlign: 'center',
    marginBottom: space.section,
  },

  scanCard: {
    alignItems: 'center',
    gap: space.cosy,
    paddingVertical: space.section,
    paddingHorizontal: space.room,
    borderRadius: 22,
    backgroundColor: colors.action,
    ...elevation.hero,
  },
  scanCardPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  scanCopy: { alignItems: 'center', gap: space.tight },
  scanTitle: { ...type.section, color: colors.onAccent, textAlign: 'center' },
  // Full-strength white: colors.action only clears AA against pure white
  // (4.96:1), so the step down to the sub is weight and size, never opacity.
  scanSub: { ...type.body, color: colors.onAccent, textAlign: 'center' },
  sweep: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.onAccent,
    shadowColor: colors.onAccent,
    shadowOpacity: 0.9,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },

  // The two account paths belong to the scan above them, so they sit close.
  pair: { flexDirection: 'row', gap: space.cosy, marginTop: space.cosy },
  pairItem: { flex: 1 },
  tile: {
    alignItems: 'center',
    gap: space.snug,
    paddingVertical: space.room,
    paddingHorizontal: space.cosy,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.lift,
  },
  tilePressed: { opacity: 0.85 },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionSurface,
  },
  tileTitle: { ...type.section, color: colors.text, textAlign: 'center' },
  tileNote: { ...type.caption, color: colors.subtle, textAlign: 'center' },

  // A different register entirely — one in a hundred visitors — so it is
  // separated generously rather than stacked into the same list.
  ownerSlot: { marginTop: space.gulf },
  ownerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
    paddingVertical: space.room,
  },
  ownerText: { ...type.body, color: colors.subtle },
  ownerLink: { ...type.label, color: colors.actionInk },
  pressed: { opacity: 0.6 },
});
