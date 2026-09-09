import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

import { ENTRANCE, type Cue } from '@/lib/domain/entrance';

/** The shared timeline every cue is positioned inside. */
const TIMELINE_MS = 1100;

/**
 * One driver for a whole screen's arrival.
 *
 * Every cue reads off the same 0→1 value with its own delay and easing, so the
 * entrance is one authored moment rather than six components each starting
 * their own timer and drifting apart on a slow device.
 *
 * It settles fully visible. Motion is never required to read the screen, and
 * with Reduce Motion on it is skipped entirely — the screen is simply there.
 */
export function useEntrance(): { progress: Animated.Value; isReduced: boolean } {
  // Lazy state, not a ref: the value is read during render to build transforms,
  // and reading a ref there is a hook-rules violation.
  const [progress] = useState(() => new Animated.Value(0));
  const [isReduced, setIsReduced] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (alive) setIsReduced(reduced);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Still asking the OS. Nothing runs until the answer arrives — it comes
    // back within a frame, and starting twice would restart the timeline.
    if (isReduced === null) return;
    if (isReduced) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: TIMELINE_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
  }, [isReduced, progress]);

  return { progress, isReduced: isReduced === true };
}

/** The 0→1 window a cue occupies inside the shared timeline. */
function cueRange(cue: Cue): [number, number] {
  return [
    cue.delay / TIMELINE_MS,
    Math.min(1, (cue.delay + cue.duration) / TIMELINE_MS),
  ];
}

/**
 * How many segments a curve is sampled into.
 *
 * The native animated module evaluates interpolations on the UI thread and
 * cannot call back into JS, so an `easing` key on an `interpolate` config is
 * rejected outright. Baking the curve into the range instead keeps every cue on
 * the native driver, and at this many segments the piecewise-linear stand-in
 * sits well under a pixel from the real curve.
 */
const CURVE_SAMPLES = 16;

function easedRange(
  start: number,
  end: number,
  easing: (value: number) => number,
  from: number,
  to: number
): { inputRange: number[]; outputRange: number[] } {
  const inputRange: number[] = [];
  const outputRange: number[] = [];
  for (let i = 0; i <= CURVE_SAMPLES; i += 1) {
    const t = i / CURVE_SAMPLES;
    inputRange.push(start + (end - start) * t);
    outputRange.push(from + (to - from) * easing(t));
  }
  return { inputRange, outputRange };
}

/**
 * Maps the shared driver onto one cue's own 0→1, with its easing applied.
 * Clamped at both ends so a cue never runs before its delay or past its end.
 */
export function useCue(
  progress: Animated.Value,
  cue: Cue,
  easing: (value: number) => number = Easing.out(Easing.cubic)
): Animated.AnimatedInterpolation<number> {
  const [start, end] = cueRange(cue);
  return progress.interpolate({
    ...easedRange(start, end, easing, 0, 1),
    extrapolate: 'clamp',
  });
}

/**
 * The wash line.
 *
 * One bright band travelling across the field — the same motif the splash
 * screen opens on, so a laundry's own gesture rather than a generic shimmer. It
 * runs exactly once, on arrival; a looping sheen is a skeleton loader, and this
 * surface is not loading.
 *
 * Purely decorative and `pointerEvents="none"`, so it can never intercept a tap
 * meant for the mark or the connect button underneath it.
 */
export function WashLine({
  progress,
  width,
  height,
}: {
  progress: Animated.Value;
  width: number;
  height: number;
}) {
  const [start, end] = cueRange(ENTRANCE.sheen);
  const band = Math.max(80, width * 0.38);

  const travel = progress.interpolate({
    ...easedRange(start, end, Easing.inOut(Easing.cubic), -band, width + band),
    extrapolate: 'clamp',
  });

  // Fades in and back out across its own travel, so the band never parks itself
  // at either edge of the hero.
  const fade = progress.interpolate({
    inputRange: [start, start + (end - start) * 0.35, end],
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  if (width <= 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        { opacity: fade, transform: [{ translateX: travel }] },
      ]}
    >
      {/* Three bands of falling opacity rather than one hard edge: a single
          rectangle reads as a white bar sliding past, three read as light. */}
      <View style={[styles.band, { width: band * 0.18, height, opacity: 0.06 }]} />
      <View
        style={[
          styles.band,
          { width: band * 0.42, height, opacity: 0.13, left: band * 0.18 },
        ]}
      />
      <View
        style={[
          styles.band,
          { width: band * 0.4, height, opacity: 0.05, left: band * 0.6 },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#FFFFFF',
    // Tilted, so the light falls across the field the way it does on a real
    // surface instead of wiping straight down it.
    transform: [{ skewX: '-18deg' }],
  },
});
