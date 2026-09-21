import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { type } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { homeRouteForRole, shouldLeaveSplash } from '@/lib/domain/splash-gate';
import { markSplashSeen } from '@/lib/splash-state';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/**
 * The opening field.
 *
 * One screen of blue, the washer, and the name. The water, the crests and the
 * dual wordmark are gone: they asked the splash to do a scene, and a scene is
 * what you wait through. This is a lockup that arrives, rests, and hands over.
 */

const FIELD = ['#04203F', '#0A3A73', '#1370CE'] as const;
const ICON = require('../../assets/images/icon.png');

const LOGO_MS = 780;
const NAME_MS = 720;
const NAME_DELAY = 220;
const FADE_MS = 380;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function Splash() {
  const { session, profile, isLoading } = useAuth();
  const router = useRouter();
  const isReduceMotion = useReducedMotion();

  const [elapsedMs, setElapsedMs] = useState(0);
  const hasLeftRef = useRef(false);

  const [logo] = useState(() => new Animated.Value(0));
  const [name] = useState(() => new Animated.Value(0));
  const [breath] = useState(() => new Animated.Value(0));
  const [exitFade] = useState(() => new Animated.Value(1));
  const breathRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isReduceMotion) {
      logo.setValue(1);
      name.setValue(1);
      return;
    }

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, {
          toValue: 1,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breath, {
          toValue: 0,
          duration: 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breathRef.current = pulse;

    Animated.parallel([
      Animated.timing(logo, {
        toValue: 1,
        duration: LOGO_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(name, {
        toValue: 1,
        duration: NAME_MS,
        delay: NAME_DELAY,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) pulse.start();
    });

    return () => pulse.stop();
  }, [isReduceMotion, logo, name, breath]);

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
      router.replace((session ? homeRouteForRole(profile?.role) : '/welcome') as never);

    if (isReduceMotion) {
      go();
      return;
    }

    breathRef.current?.stop();
    Animated.timing(exitFade, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(go);
  }, [router, session, profile?.role, exitFade, isReduceMotion]);

  useEffect(() => {
    if (shouldLeaveSplash({ elapsedMs, isAuthLoading: isLoading })) leave();
  }, [elapsedMs, isLoading, leave]);

  const logoStyle = {
    opacity: logo,
    transform: [
      {
        scale: Animated.add(
          logo.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }),
          breath.interpolate({ inputRange: [0, 1], outputRange: [0, 0.035] })
        ),
      },
    ],
  };

  const nameStyle = {
    opacity: name,
    transform: [{ translateY: name.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
  };

  return (
    <AnimatedPressable
      style={[styles.screen, { opacity: exitFade }]}
      accessibilityRole="button"
      accessibilityLabel="Continue to MiLaundry"
      onPress={() => {
        if (!isLoading) leave();
      }}
    >
      <StatusBar style="light" />

      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <SvgLinearGradient id="field" x1="0" y1="0" x2="0.2" y2="1">
            <Stop offset="0" stopColor={FIELD[0]} />
            <Stop offset="0.55" stopColor={FIELD[1]} />
            <Stop offset="1" stopColor={FIELD[2]} />
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#field)" />
      </Svg>

      <View style={styles.lockup} pointerEvents="none">
        <Animated.View style={[styles.mark, logoStyle]}>
          <View style={styles.glow} />
          <Image source={ICON} style={styles.logo} accessibilityIgnoresInvertColors />
        </Animated.View>
        <Animated.View style={nameStyle}>
          <Text style={styles.wordmark}>MiLaundry</Text>
        </Animated.View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: FIELD[0] },
  lockup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
  },
  mark: { width: 128, height: 128, alignItems: 'center', justifyContent: 'center' },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(32, 138, 239, 0.22)',
  },
  logo: { width: 128, height: 128, borderRadius: 28 },
  wordmark: {
    ...type.hero,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -1.2,
    color: '#FFFFFF',
  },
});
