import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { REVEAL_STAGGER_MS, Reveal } from '@/components/reveal';
import { TypedCodeForm } from '@/components/typed-code-form';
import { ACCENTS, Button, colors, elevation, space, type } from '@/components/ui-kit';
import { peekScan } from '@/lib/api';
import { shopInitials } from '@/lib/domain/connected-shops';
import { parseQrPayload } from '@/lib/domain/qr';
import { scanEntryMode } from '@/lib/domain/scan-entry';
import { resolveAccent } from '@/lib/domain/shop-branding';
import {
  type PendingScan,
  SCAN_RETRY_MS,
  type ScanProblem,
  scanProblem,
  scanWelcome,
} from '@/lib/domain/welcome-flow';
import { clearPendingScan, setPendingScan } from '@/lib/pending-scan-store';
import { useHaptic } from '@/lib/use-app-settings';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * The scan, before there is an account.
 *
 * A guest points the camera at the code on the counter and the laundry
 * answers by name — "Sparkle Wash is ready for you" — *before* being asked for
 * anything. Then the two ways in are offered on the laundry's own card, in its
 * own colour, and whichever one they take finishes the connection for them.
 *
 * The camera stops the instant a code is recognised. A viewfinder still
 * hunting behind a card that says "found" contradicts the card.
 */

/** The dark over everything the viewfinder is not looking at. */
const SCRIM = 'rgba(4, 32, 63, 0.62)';
const FRAME_MAX = 264;
const FRAME_SIDE_MARGIN = 88;
const BRACKET = 28;
const BRACKET_STROKE = 3;
/** One reading pass across the frame, then a rest. */
const SWEEP_MS = 1700;
const SWEEP_REST_MS = 900;
/** The found card's rise. */
const CARD_RISE_MS = 460;

export default function ScanLaundry() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const haptic = useHaptic();
  const isReduced = useReducedMotion();
  const [permission, requestPermission] = useCameraPermissions();

  const [found, setFound] = useState<PendingScan | null>(null);
  const [problem, setProblem] = useState('');
  const [isLooking, setIsLooking] = useState(false);
  const isHandlingRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    },
    []
  );

  const fail = useCallback(
    (kind: ScanProblem) => {
      haptic('error');
      setProblem(scanProblem(kind));
      retryTimerRef.current = setTimeout(() => {
        setProblem('');
        isHandlingRef.current = false;
      }, SCAN_RETRY_MS);
    },
    [haptic]
  );

  const handleScanned = async ({ data }: { data: string }) => {
    if (isHandlingRef.current || found) return;
    isHandlingRef.current = true;

    const payload = parseQrPayload(data);
    if (!payload) {
      fail('not-ours');
      return;
    }

    setIsLooking(true);
    try {
      const shop = await peekScan(payload.type, payload.id, payload.token);
      if (!shop) {
        fail('inactive');
        return;
      }
      const scan: PendingScan = { ...payload, shop };
      setPendingScan(scan);
      haptic('success');
      setFound(scan);
    } catch {
      fail('network');
    } finally {
      setIsLooking(false);
    }
  };

  const scanAgain = () => {
    clearPendingScan();
    setFound(null);
    isHandlingRef.current = false;
  };

  const leave = () => {
    clearPendingScan();
    router.back();
  };

  const frame = Math.min(FRAME_MAX, width - FRAME_SIDE_MARGIN);

  const foundCard = found ? (
    <FoundCard
      scan={found}
      bottomInset={insets.bottom}
      isReduced={isReduced}
      onCreate={() => {
        haptic('commit');
        router.push('/sign-up');
      }}
      onSignIn={() => {
        haptic('tap');
        router.push('/sign-in');
      }}
      onScanAgain={scanAgain}
    />
  ) : null;

  // The browser cannot decode a code: the link under the square is typed in
  // and fed to the same lookup the camera feeds.
  if (scanEntryMode(Platform.OS) === 'typed') {
    return (
      <View style={styles.root}>
        <StatusBar style="light" />
        <View style={[styles.ask, { paddingTop: insets.top + space.gulf }]}>
          <TopBar onBack={leave} title="Enter your code" />
          <View style={styles.askBody}>
            <Frame size={120} isSweeping={isLooking} isReduced={isReduced} />
            <TypedCodeForm
              onCode={(raw) => void handleScanned({ data: raw })}
              isBusy={isLooking}
              problem={problem}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/sign-in')}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.link}>No code nearby? Sign in instead</Text>
            </Pressable>
          </View>
        </View>
        {foundCard}
      </View>
    );
  }

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.ask, { paddingTop: insets.top + space.gulf }]}>
        <StatusBar style="light" />
        <TopBar onBack={leave} title="Scan your laundry" />
        <View style={styles.askBody}>
          <Frame size={160} isSweeping={false} isReduced={isReduced} />
          <Text style={styles.askTitle}>Let the camera see the code</Text>
          <Text style={styles.askText}>
            MiLaundry only uses the camera to read the code at your laundry&apos;s
            counter. Nothing is recorded.
          </Text>
          <View style={styles.askActions}>
            {permission.canAskAgain ? (
              <Button title="Allow camera" onPress={requestPermission} />
            ) : (
              <Button title="Open Settings" onPress={() => Linking.openSettings()} />
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/sign-in')}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={styles.link}>Sign in without scanning</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <CameraView
        style={StyleSheet.absoluteFill}
        active={!found}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScanned}
      />

      {/* The scrim, with the frame left clear ---------------------------- */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={[styles.scrim, styles.scrimTop, { paddingTop: insets.top + space.snug }]}>
          <TopBar onBack={leave} title="Scan your laundry" />
        </View>
        <View style={[styles.band, { height: frame }]}>
          <View style={styles.scrim} />
          <Frame size={frame} isSweeping={!found && !isLooking} isReduced={isReduced} />
          <View style={styles.scrim} />
        </View>
        <View style={[styles.scrim, styles.scrimBottom, { paddingBottom: insets.bottom + space.section }]}>
          {!found && (
            <View style={styles.hintBlock}>
              {isLooking ? (
                <View style={styles.hintRow}>
                  <ActivityIndicator color={colors.onAccent} />
                  <Text style={styles.hint}>Asking the laundry…</Text>
                </View>
              ) : problem ? (
                <View style={styles.problemPill}>
                  <Ionicons name="alert-circle" size={16} color={colors.onAccent} />
                  <Text style={styles.problem}>{problem}</Text>
                </View>
              ) : (
                <Text style={styles.hint}>
                  Point at the MiLaundry code at the counter
                </Text>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/sign-in')}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <Text style={styles.link}>No code nearby? Sign in instead</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {foundCard}
    </View>
  );
}

function TopBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.onAccent} />
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      <View style={styles.backButton} />
    </View>
  );
}

/**
 * The viewfinder: four brackets, and a line that reads across the opening
 * while the camera is looking.
 */
function Frame({
  size,
  isSweeping,
  isReduced,
}: {
  size: number;
  isSweeping: boolean;
  isReduced: boolean;
}) {
  const [sweep] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!isSweeping || isReduced) {
      sweep.stopAnimation();
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
  }, [sweep, isSweeping, isReduced]);

  const travel = size - BRACKET_STROKE * 2 - 2;

  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.bracket, styles.bracketTL]} />
      <View style={[styles.bracket, styles.bracketTR]} />
      <View style={[styles.bracket, styles.bracketBL]} />
      <View style={[styles.bracket, styles.bracketBR]} />
      {isSweeping && !isReduced && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweep,
            {
              opacity: sweep.interpolate({
                inputRange: [0, 0.06, 0.94, 1],
                outputRange: [0, 1, 1, 0],
              }),
              transform: [
                {
                  translateY: sweep.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, travel],
                  }),
                },
              ],
            },
          ]}
        />
      )}
    </View>
  );
}

/**
 * The laundry answering. Rises from the bottom in the shop's own colour, the
 * mark landing with a little overshoot — the same arrival the shopfront gives
 * it, so the card is a preview of where they are about to be.
 */
function FoundCard({
  scan,
  bottomInset,
  isReduced,
  onCreate,
  onSignIn,
  onScanAgain,
}: {
  scan: PendingScan;
  bottomInset: number;
  isReduced: boolean;
  onCreate: () => void;
  onSignIn: () => void;
  onScanAgain: () => void;
}) {
  const [rise] = useState(() => new Animated.Value(0));
  const [land] = useState(() => new Animated.Value(0));
  const accent = ACCENTS[resolveAccent(scan.shop, ACCENTS.length)];
  const welcome = scanWelcome(scan);

  useEffect(() => {
    if (isReduced) {
      rise.setValue(1);
      land.setValue(1);
      return;
    }
    const sequence = Animated.parallel([
      Animated.timing(rise, {
        toValue: 1,
        duration: CARD_RISE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(land, {
        toValue: 1,
        duration: 520,
        delay: 140,
        easing: Easing.out(Easing.back(1.6)),
        useNativeDriver: true,
      }),
    ]);
    sequence.start();
    return () => sequence.stop();
  }, [rise, land, isReduced]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          paddingBottom: bottomInset + space.section,
          opacity: rise,
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.cardHandle} />
      <View style={styles.shopRow}>
        <Animated.View
          style={[
            styles.mark,
            {
              backgroundColor: accent.surface,
              borderColor: accent.ink,
              transform: [
                { scale: land.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              ],
              opacity: land,
            },
          ]}
        >
          <Text style={[styles.markText, { color: accent.ink }]}>
            {shopInitials(scan.shop.name)}
          </Text>
        </Animated.View>
        <View style={styles.shopCopy}>
          <Reveal delay={REVEAL_STAGGER_MS}>
            <Text style={styles.shopName} numberOfLines={1}>
              {scan.shop.name}
            </Text>
          </Reveal>
          <Reveal delay={REVEAL_STAGGER_MS * 2}>
            <Text style={styles.shopMeta} numberOfLines={1}>
              {scan.shop.tagline || `/${scan.shop.slug}`}
            </Text>
          </Reveal>
        </View>
        <Reveal delay={REVEAL_STAGGER_MS * 2}>
          <View style={[styles.foundBadge, { backgroundColor: accent.surface }]}>
            <Ionicons name="checkmark" size={14} color={accent.ink} />
            <Text style={[styles.foundBadgeText, { color: accent.ink }]}>Found</Text>
          </View>
        </Reveal>
      </View>

      <Reveal delay={REVEAL_STAGGER_MS * 3} style={styles.welcome}>
        <Text style={styles.welcomeHeading}>{welcome.heading}</Text>
        <Text style={styles.welcomeBody}>{welcome.body}</Text>
      </Reveal>

      <Reveal delay={REVEAL_STAGGER_MS * 4} style={styles.cardActions}>
        <Button title={welcome.primary} onPress={onCreate} />
        <Button title={welcome.secondary} variant="outline" onPress={onSignIn} />
        <Pressable
          accessibilityRole="button"
          onPress={onScanAgain}
          style={({ pressed }) => [styles.again, pressed && styles.pressed]}
        >
          <Text style={styles.againText}>Scan a different code</Text>
        </Pressable>
      </Reveal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#04203F' },
  pressed: { opacity: 0.6 },

  scrim: { flex: 1, backgroundColor: SCRIM },
  scrimTop: { justifyContent: 'flex-start' },
  scrimBottom: { flex: 1.25, justifyContent: 'flex-end', paddingHorizontal: space.section },
  band: { flexDirection: 'row' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.cosy,
    gap: space.snug,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  topTitle: { ...type.section, color: colors.onAccent, flex: 1, textAlign: 'center' },

  bracket: {
    position: 'absolute',
    width: BRACKET,
    height: BRACKET,
    borderColor: colors.onAccent,
  },
  bracketTL: {
    top: 0,
    left: 0,
    borderTopWidth: BRACKET_STROKE,
    borderLeftWidth: BRACKET_STROKE,
    borderTopLeftRadius: 8,
  },
  bracketTR: {
    top: 0,
    right: 0,
    borderTopWidth: BRACKET_STROKE,
    borderRightWidth: BRACKET_STROKE,
    borderTopRightRadius: 8,
  },
  bracketBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: BRACKET_STROKE,
    borderLeftWidth: BRACKET_STROKE,
    borderBottomLeftRadius: 8,
  },
  bracketBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: BRACKET_STROKE,
    borderRightWidth: BRACKET_STROKE,
    borderBottomRightRadius: 8,
  },
  sweep: {
    position: 'absolute',
    left: BRACKET_STROKE + 6,
    right: BRACKET_STROKE + 6,
    top: BRACKET_STROKE,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#8FD3FF',
    shadowColor: '#8FD3FF',
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  hintBlock: { alignItems: 'center', gap: space.section },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  hint: { ...type.body, color: colors.onAccent, textAlign: 'center', opacity: 0.92 },
  problemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingVertical: space.snug,
    paddingHorizontal: space.cosy,
    borderRadius: 999,
    backgroundColor: colors.dangerInk,
  },
  problem: { ...type.label, color: colors.onAccent, flexShrink: 1 },
  link: { ...type.label, color: colors.onAccent, opacity: 0.85, textDecorationLine: 'underline' },

  ask: { paddingHorizontal: space.section },
  askBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.room },
  askTitle: { ...type.title, color: colors.onAccent, textAlign: 'center', marginTop: space.section },
  askText: {
    ...type.body,
    color: colors.onAccent,
    opacity: 0.85,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  askActions: { alignSelf: 'stretch', alignItems: 'center', gap: space.room, marginTop: space.snug },

  card: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: colors.card,
    paddingHorizontal: space.section,
    paddingTop: space.cosy,
    gap: space.section,
    ...elevation.hero,
  },
  cardHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
  },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { ...type.section, fontSize: 20, letterSpacing: 0.5 },
  shopCopy: { flex: 1, gap: 2 },
  shopName: { ...type.section, fontSize: 18, color: colors.text },
  shopMeta: { ...type.caption, fontSize: 13, color: colors.subtle },
  foundBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  foundBadgeText: { ...type.caption, fontWeight: '700' },

  welcome: { gap: space.tight },
  welcomeHeading: { ...type.title, color: colors.text },
  welcomeBody: { ...type.body, color: colors.subtle, lineHeight: 21 },

  cardActions: { gap: space.cosy },
  again: { alignSelf: 'center', paddingVertical: space.tight },
  againText: { ...type.label, color: colors.subtle },
});
