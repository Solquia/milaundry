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

import { BlueField } from '@/components/blue-field';
import { BLUE_FIELD, colors, elevation, space, type } from '@/components/ui-kit';
import {
  ON_FIELD,
  ON_FIELD_SOFT,
  WaveHem,
  WelcomeScene,
} from '@/components/welcome-scene';
import { RADII } from '@/lib/domain/design-scale';
import { useHaptic } from '@/lib/use-app-settings';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * The front door.
 *
 * The splash hands over to this, not to a form. Someone opening MiLaundry for
 * the first time is almost always standing at a counter with a code in front
 * of them, so the scan is the one big control and everything else is the way
 * to *finish* it: sign in if you have an account, create one if you don't.
 * Owners get their own tile — they are one in a hundred visitors, but a tile
 * is cheaper to skip past than a line of text is to find.
 *
 * ## The shape
 *
 * Two regions, and the seam between them is the whole idea. Above: the blue
 * field the customer's home stands on, so the app has one light rather than a
 * gradient per screen. Below: the white the product actually lives on. Between
 * them, not the arc a hero usually gets but the splash's own crest, run upside
 * down — so the handover reads as a continuation of the same water rather than
 * as a cut to a different screen. It drifts forever, at three speeds, and it
 * is the one thing here that never settles.
 *
 * Nothing is written on the water but the name and the greeting. The tagline
 * under the mark was the app describing itself to someone already holding a
 * code; the mark says who this is and the two lines below say what to do.
 *
 * The mark returns at two-thirds the splash's size. This screen used to leave
 * it out on the reasoning that the splash had just spent four seconds saying
 * the name — right, when the name would have been re-announced at full size on
 * an empty field. At 34pt over water it is a masthead rather than a second
 * introduction, which is the difference between a title page and a letterhead.
 *
 * ## The arrival
 *
 * One order, and it is the order the visitor needs things in: the mark, the
 * sentence that tells them where their code is, the scene, the ways in, the
 * commit. Each beat is a translate and a fade on the native driver, so the
 * sequence holds 60fps on the cheap Android handsets this app is mostly opened
 * on — and every driver is sent straight to its settled value when the device
 * asks for less motion. Nothing here is ever required in order to read the
 * screen.
 */

/** The mark lands first: it is what says the handover completed. */
const MARK_MS = 460;
/** The sentence the scan answers, so it follows the mark closely. */
const LEDE_MS = 440;
const LEDE_DELAY_MS = 120;
/** The scene is scenery. It arrives under the words, never before them. */
const SCENE_MS = 620;
const SCENE_DELAY_MS = 220;
/** The ways in, staggered across one driver so they cannot drift apart. */
const TILES_MS = 560;
const TILES_DELAY_MS = 380;
/** The commit, last, because it is what you do once you have read the rest. */
const COMMIT_MS = 420;
const COMMIT_DELAY_MS = 560;

/** Pointer feedback. Small numbers: this is a press, not a jump. */
const HOT_MS = 160;

/**
 * A phone's column, held at a phone's width. On a tablet the sheet would
 * otherwise stretch four tiles across a metre of white.
 */
const COLUMN_MAX = 430;

/** An arrival curve, not a UI curve: decelerate hard and stop dead. */
const ARRIVE_EASING = Easing.out(Easing.cubic);

/** The sheet, and therefore the colour the nearest crest is filled in. */
const SHEET = colors.card;

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * The ways in, in the order a first-time visitor needs them.
 *
 * Every one is also reachable further along; this row is the shortcut, not the
 * only door.
 *
 * One word each, and short enough that none of them wraps. "Scan code" and
 * "New account" set on two lines, which made the row a block of text with
 * pictures in it; at a quarter of a 360pt screen there is room for "Sign up"
 * on one line and not for much more, so the labels were cut to fit rather
 * than the type shrunk to hide it.
 *
 * The tints are the app's identity accents, the same six a shop is assigned
 * from. Four identical blue tiles is a row you have to read word by word.
 */
const WAYS = [
  { key: 'scan', icon: 'qr-code-outline' as IconName, label: 'Scan', tint: '#1263AF' },
  { key: 'signin', icon: 'key-outline' as IconName, label: 'Sign in', tint: '#0F6B5F' },
  { key: 'signup', icon: 'person-add-outline' as IconName, label: 'Sign up', tint: '#4B3FBF' },
  { key: 'owner', icon: 'storefront-outline' as IconName, label: 'Owners', tint: '#8A5606' },
] as const;

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isReduced = useReducedMotion();
  const haptic = useHaptic();
  const { width: screenWidth } = useWindowDimensions();

  // One driver per beat. Lazy state rather than refs: these are read during
  // render to build the transforms, and reading a ref there breaks hook rules.
  const [mark] = useState(() => new Animated.Value(0));
  const [lede] = useState(() => new Animated.Value(0));
  const [scene] = useState(() => new Animated.Value(0));
  const [tiles] = useState(() => new Animated.Value(0));
  const [commit] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isReduced) {
      for (const driver of [mark, lede, scene, tiles, commit]) driver.setValue(1);
      return;
    }
    const arrival = Animated.parallel([
      beat(mark, MARK_MS, 0),
      beat(lede, LEDE_MS, LEDE_DELAY_MS),
      beat(scene, SCENE_MS, SCENE_DELAY_MS),
      beat(tiles, TILES_MS, TILES_DELAY_MS),
      beat(commit, COMMIT_MS, COMMIT_DELAY_MS),
    ]);
    arrival.start();
    return () => arrival.stop();
  }, [commit, isReduced, lede, mark, scene, tiles]);

  const go = (path: string, weight: 'tap' | 'commit' = 'tap') => {
    haptic(weight);
    router.push(path as never);
  };
  const goOwner = () => {
    haptic('tap');
    router.push({ pathname: '/sign-in', params: { as: 'owner' } } as never);
  };

  const onWay = (key: (typeof WAYS)[number]['key']) => {
    if (key === 'scan') return go('/scan-laundry', 'commit');
    if (key === 'signin') return go('/sign-in');
    if (key === 'signup') return go('/sign-up');
    return goOwner();
  };

  // Held off the gutters and capped, so the scene never becomes the whole hero
  // on a tablet or a postage stamp on a 360pt phone.
  const sceneWidth = Math.min(Math.round(Math.min(screenWidth, COLUMN_MAX) * 0.74), 300);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* ── The water ──────────────────────────────────────────────────── */}
        <View style={[styles.hero, { paddingTop: insets.top + space.gulf }]}>
          {/* The elegant blue the home stands on, rather than a gradient of
              this screen's own. One light, two surfaces. */}
          <BlueField />

          <View style={styles.heroColumn}>
            <Beat driver={mark} rise={16} style={styles.markBlock}>
              <Text style={styles.wordmark} accessibilityRole="header">
                MiLaundry
              </Text>
            </Beat>

            <Beat driver={lede} rise={14} style={styles.ledeBlock}>
              <Text style={styles.ledeStrong}>Welcome.</Text>
              <Text style={styles.lede}>Your code is at the counter.</Text>
            </Beat>

            <Beat driver={scene} rise={22} style={styles.sceneSlot}>
              <WelcomeScene width={sceneWidth} />
            </Beat>
          </View>

          {/* The seam. Drawn last so it sits over the field, and in the sheet's
              own colour so the white below simply continues out of it. */}
          <WaveHem width={screenWidth} sheet={SHEET} isStill={isReduced} />
        </View>

        {/* ── The sheet ──────────────────────────────────────────────────── */}
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.section }]}>
          <View style={styles.sheetColumn}>
            <Text style={styles.sheetLabel}>Get started</Text>

            <View style={styles.wayRow}>
              {WAYS.map((way, index) => (
                <Beat
                  key={way.key}
                  driver={tiles}
                  rise={18}
                  from={index * 0.1}
                  style={styles.waySlot}
                >
                  <WayTile way={way} onPress={() => onWay(way.key)} />
                </Beat>
              ))}
            </View>

            <Beat driver={commit} rise={16} style={styles.commitRow}>
              {/* The one big control, and beside it the fast lane for someone
                  who has been here before — the pairing the reference makes
                  with a login button and a fingerprint. */}
              <CommitButton
                label="Scan your laundry"
                hint="Opens the camera to connect to a laundry"
                isReduced={isReduced}
                onPress={() => go('/scan-laundry', 'commit')}
              />
              <SquareButton icon="log-in-outline" label="Sign in" onPress={() => go('/sign-in')} />
            </Beat>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** One beat of the arrival, as a timing on the native driver. */
function beat(driver: Animated.Value, duration: number, delay: number) {
  return Animated.timing(driver, {
    toValue: 1,
    duration,
    delay,
    easing: ARRIVE_EASING,
    useNativeDriver: true,
  });
}

/**
 * A block that rises into place.
 *
 * `from` reads a window of a shared driver rather than taking its own delay,
 * so a row of them staggers without the four clocks ever drifting apart.
 */
function Beat({
  driver,
  rise,
  from = 0,
  style,
  children,
}: {
  driver: Animated.Value;
  rise: number;
  from?: number;
  style?: object;
  children: React.ReactNode;
}) {
  const window = { inputRange: [from, from + 0.7], extrapolate: 'clamp' as const };
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: driver.interpolate({ ...window, outputRange: [0, 1] }),
          transform: [{ translateY: driver.interpolate({ ...window, outputRange: [rise, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** One way in: a tinted disc, a drawn icon, and its name on two lines. */
function WayTile({ way, onPress }: { way: (typeof WAYS)[number]; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={way.label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.way,
        { backgroundColor: tintSurface(way.tint), borderColor: tintBorder(way.tint) },
        pressed && styles.wayPressed,
      ]}
    >
      <Ionicons name={way.icon} size={24} color={way.tint} />
      <Text style={[styles.wayLabel, { color: way.tint }]} numberOfLines={1}>
        {way.label}
      </Text>
    </Pressable>
  );
}

/**
 * The pale field a tinted icon sits on: the ink itself at a tenth strength.
 *
 * Derived rather than listed, because four more hand-picked hex values would
 * be four more things to keep in step with the inks above them — and the ink
 * is already the value that has to clear contrast.
 */
function tintSurface(ink: string): string {
  return `${ink}14`;
}

/** The hairline that gives the tile an edge without becoming a second colour. */
function tintBorder(ink: string): string {
  return `${ink}2E`;
}

/** The commit. Wide, filled, and the only pill on the screen. */
function CommitButton({
  label,
  hint,
  isReduced,
  onPress,
}: {
  label: string;
  hint: string;
  isReduced: boolean;
  onPress: () => void;
}) {
  const [hot] = useState(() => new Animated.Value(0));

  const move = (to: number) => {
    if (isReduced) return;
    Animated.timing(hot, {
      toValue: to,
      duration: HOT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.commitSlot,
        { transform: [{ scale: hot.interpolate({ inputRange: [0, 1], outputRange: [1, 0.98] }) }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        onPress={onPress}
        onPressIn={() => move(1)}
        onPressOut={() => move(0)}
        style={styles.commitButton}
      >
        <Ionicons name="qr-code" size={20} color={ON_FIELD} />
        <Text style={styles.commitLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

/** The fast lane beside it, at the commit's own height so the pair sits level. */
function SquareButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.square, pressed && styles.squarePressed]}
    >
      <Ionicons name={icon} size={24} color={ON_FIELD} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // The root wears the water, so the status bar and any overscroll at the top
  // are the deep end rather than a white strip above the hero.
  root: { flex: 1, backgroundColor: BLUE_FIELD.deep },
  scroll: { flexGrow: 1 },

  /** The water, and everything drawn in it. */
  hero: { overflow: 'hidden' },
  heroColumn: {
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: COLUMN_MAX,
    paddingHorizontal: space.room,
    gap: space.room,
  },

  markBlock: { alignItems: 'center' },
  /**
   * The masthead. 34pt against the splash's 50: the same lockup, worn rather
   * than announced. -0.03em is the optical correction a geometric face needs
   * at display size, and stays inside the project's tracking floor.
   */
  wordmark: { ...type.hero, color: ON_FIELD, letterSpacing: -1 },

  ledeBlock: { alignItems: 'center', gap: 2 },
  /** Two lines, one voice: the greeting leads, the fact follows it. */
  ledeStrong: {
    ...type.body,
    fontFamily: type.label.fontFamily,
    fontSize: 17,
    color: ON_FIELD,
    textAlign: 'center',
  },
  lede: { ...type.body, fontSize: 17, color: ON_FIELD_SOFT, textAlign: 'center' },

  /**
   * The water the scene stands in. The hem is a sibling below this, so the
   * crests cannot reach the machine on their own — this is the depth between
   * the object and the surface, which is what stops the scene from looking
   * like it is sitting on the edge.
   */
  sceneSlot: { alignItems: 'center', paddingBottom: space.section },

  /** The white the product lives on. Its top edge is the hem's near crest. */
  sheet: {
    flexGrow: 1,
    backgroundColor: SHEET,
    paddingTop: space.snug,
    paddingHorizontal: space.room,
  },
  sheetColumn: { width: '100%', maxWidth: COLUMN_MAX, alignSelf: 'center', gap: space.section },
  /**
   * The sheet's one label. Centred and in the action blue, the way the
   * reference heads its shortcut row — a signpost over the set rather than a
   * heading that owns the rest of the screen.
   */
  sheetLabel: { ...type.label, color: colors.actionInk, textAlign: 'center', letterSpacing: 0.3 },

  wayRow: { flexDirection: 'row', gap: space.snug },
  waySlot: { flex: 1 },
  /**
   * A square with curved sides, not a disc with a caption under it.
   *
   * The disc was the target and the words were a label beside it, so the four
   * of them read as icons someone had annotated. As a box the whole tile is
   * the button: one shape, one press area, the icon and its name inside it.
   * `aspectRatio` rather than a fixed height so the row stays square from a
   * 360pt phone to a tablet, and 18 is the app's own card curve — a softer
   * radius here would have made four pills again.
   */
  way: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
    paddingHorizontal: space.tight,
  },
  wayPressed: { opacity: 0.6, transform: [{ scale: 0.97 }] },
  /**
   * 58pt: comfortably past the 44pt touch minimum on its own, so the caption
   * beneath it is a label rather than part of the target.
   */
  /** One line, always: the labels were shortened so they never wrap. */
  wayLabel: {
    ...type.label,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
  },

  commitRow: { flexDirection: 'row', alignItems: 'stretch', gap: space.snug },
  commitSlot: { flex: 1 },
  /**
   * The one pill on the screen, and the only filled blue in the sheet. 56pt
   * tall so it stands level with the square beside it.
   */
  commitButton: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
    borderRadius: RADII.pill,
    backgroundColor: colors.action,
    ...elevation.rest,
  },
  commitLabel: { ...type.body, fontFamily: type.label.fontFamily, fontSize: 17, color: ON_FIELD },

  /**
   * The fast lane. Square rather than a second pill, and in the hero's deep
   * water rather than the action blue: two pills side by side would be two
   * primaries, and the deeper tone says "the other way" without saying "the
   * lesser way".
   */
  square: {
    width: 56,
    height: 56,
    borderRadius: RADII.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_FIELD.mid,
    ...elevation.rest,
  },
  squarePressed: { opacity: 0.8 },
});
