/**
 * The goal just got hit: a burst of soap bubbles rising off the screen and a
 * gold card saying so, once a day. With reduced motion on, the card appears
 * without the bubbles. It never blocks a tap for longer than it shows.
 */
import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { formatMoneyCompact } from '@/lib/domain/money';
import { useReducedMotion } from '@/lib/use-reduced-motion';

import { RADII, elevation, space, type } from './ui-kit';

const BUBBLES = 16;
const SHOWN_MS = 2_600;
const RISE_MS = 1_900;

function Bubble({ x, size, delay, height }: { x: number; size: number; delay: number; height: number }) {
  const rise = useSharedValue(0);
  useEffect(() => {
    rise.value = withDelay(delay, withTiming(1, { duration: RISE_MS, easing: Easing.out(Easing.quad) }));
  }, [rise, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - rise.value,
    transform: [{ translateY: -rise.value * height * 0.75 }, { scale: 0.6 + rise.value * 0.6 }],
  }));
  return (
    <Animated.View
      style={[styles.bubble, { left: x, width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}

export function GoalBurst({ goal, onDone }: { goal: number | null; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const isReduced = useReducedMotion();

  const bubbles = useMemo(
    () =>
      Array.from({ length: BUBBLES }, (_, index) => ({
        key: index,
        x: ((index * 37) % 100) / 100 * (width - 40) + 4,
        size: 14 + ((index * 13) % 22),
        delay: (index * 70) % 600,
      })),
    [width]
  );

  useEffect(() => {
    if (goal === null) return;
    const timer = setTimeout(onDone, SHOWN_MS);
    return () => clearTimeout(timer);
  }, [goal, onDone]);

  if (goal === null) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {isReduced
        ? null
        : bubbles.map((bubble) => (
            <Bubble key={bubble.key} x={bubble.x} size={bubble.size} delay={bubble.delay} height={height} />
          ))}
      <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut} style={styles.card}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={styles.title}>Goal hit!</Text>
        <Text style={styles.body}>{formatMoneyCompact(goal)} taken today. Galing!</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    bottom: 40,
    borderWidth: 1.5,
    borderColor: 'rgba(32, 138, 239, 0.55)',
    backgroundColor: 'rgba(182, 212, 242, 0.35)',
  },
  card: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.room,
    paddingHorizontal: space.gulf,
    borderRadius: RADII.sheet,
    backgroundColor: '#FFF7E0',
    borderWidth: 2,
    borderColor: '#F6C453',
    ...elevation.hero,
  },
  emoji: { fontSize: 36 },
  title: { ...type.title, color: '#8A5A00' },
  body: { ...type.caption, color: '#8A5A00' },
});