import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { HERO_GRADIENT, colors, space, type } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import {
  SPLASH_MAX_MS,
  homeRouteForRole,
  shouldLeaveSplash,
} from '@/lib/domain/splash-gate';
import { markSplashSeen } from '@/lib/splash-state';

/** How often the elapsed time is re-checked against the splash gate. */
const TICK_MS = 100;

/**
 * The first screen of the app: the wordmark on the brand field, held while the
 * saved session is restored, then handed to sign-in or straight to the
 * account's own home. Tapping skips the wait once the session is known.
 */
export default function Splash() {
  const { session, profile, isLoading } = useAuth();
  const router = useRouter();
  const [elapsedMs, setElapsedMs] = useState(0);
  const hasLeftRef = useRef(false);
  // State, not a ref: the value is read during render to build the style, and
  // the lazy initialiser keeps one instance for the life of the screen.
  const [entrance] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 520,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  // The clock is the external system here: the gate is a pure function of how
  // long the splash has been up and whether auth has settled.
  useEffect(() => {
    const startedAt = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - startedAt), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const leave = useCallback(() => {
    if (hasLeftRef.current) return;
    hasLeftRef.current = true;
    markSplashSeen();
    router.replace(
      (session ? homeRouteForRole(profile?.role) : '/sign-in') as never
    );
  }, [router, session, profile?.role]);

  useEffect(() => {
    if (shouldLeaveSplash({ elapsedMs, isAuthLoading: isLoading })) leave();
  }, [elapsedMs, isLoading, leave]);

  const isWaitingOnSession = isLoading && elapsedMs < SPLASH_MAX_MS;

  return (
    <Pressable
      style={styles.screen}
      accessibilityRole="button"
      accessibilityLabel="Continue to MiLaundry"
      // Skipping is only offered once there is somewhere certain to go.
      onPress={() => {
        if (!isLoading) leave();
      }}
    >
      <StatusBar style="light" />

      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id="splashField" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={HERO_GRADIENT[0]} />
            <Stop offset="0.55" stopColor={HERO_GRADIENT[1]} />
            <Stop offset="1" stopColor={HERO_GRADIENT[2]} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#splashField)" />
      </Svg>

      <Animated.View
        style={[
          styles.mark,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.badge}>
          <Ionicons name="water" size={38} color="#FFFFFF" />
        </View>
        <Text style={styles.wordmark}>MiLaundry</Text>
        <Text style={styles.tagline}>Fresh clothes, handled for you</Text>
      </Animated.View>

      <View style={styles.foot}>
        <Text style={styles.footText}>
          {isWaitingOnSession ? 'Getting things ready…' : 'Tap to continue'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { alignItems: 'center', gap: space.cosy },
  badge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  wordmark: {
    ...type.hero,
    fontSize: 38,
    color: '#FFFFFF',
  },
  tagline: { ...type.body, color: '#CFE6FF' },
  foot: { position: 'absolute', bottom: space.gulf + space.section },
  footText: { ...type.caption, color: '#BFDCFB' },
});
