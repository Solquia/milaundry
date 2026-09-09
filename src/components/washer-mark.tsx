import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useReducedMotion } from '@/lib/use-reduced-motion';

import { colors } from './ui-kit';

/** One full turn of the drum. Slow enough to read as a wash, not a spinner. */
const TUMBLE_MS = 3600;

/**
 * The brand mark: a laundry drum, and the app's one authored piece of motion.
 *
 * A stock t-shirt glyph sat here before, which any clothing app could have
 * used. This is drawn from the product's own mechanism — a drum ring with three
 * loads tumbling inside — and it shares its concentric-circle language with
 * `TrackDial`, so the two marks read as one family.
 *
 * **The drum turns only while laundry is actually in the wash.** That is the
 * point: the motion is a state readout, not decoration. A still drum means
 * nothing of yours is being washed, which is information the screen would
 * otherwise spend a sentence on. It also means the loop is not running on the
 * screen customers open most — an idle home screen animates nothing at all.
 */
export function WasherMark({
  size = 34,
  isRunning,
}: {
  size?: number;
  isRunning: boolean;
}) {
  const isReduced = useReducedMotion();
  // Lazy state, not a ref: the driver is read during render to build the
  // transform, and reading a ref there is a hook-rules violation.
  const [spin] = useState(() => new Animated.Value(0));

  const centre = size / 2;
  const ring = (size - 2.5) / 2;
  const orbit = ring * 0.52;
  const load = size * 0.085;

  useEffect(() => {
    if (!isRunning || isReduced) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: TUMBLE_MS,
        // Linear: a drum turns at a constant rate. Easing would read as a
        // stutter on every revolution.
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();

    return () => loop.stop();
  }, [isRunning, isReduced, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ width: size, height: size }}>
      {/* The drum itself never turns — only what is inside it. */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={centre}
          cy={centre}
          r={ring}
          stroke={colors.onAccent}
          strokeWidth={2.5}
          fill="none"
        />
      </Svg>

      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}
        pointerEvents="none"
      >
        <Svg width={size} height={size}>
          {[0, 120, 240].map((degrees) => {
            const radians = (degrees * Math.PI) / 180;
            return (
              <Circle
                key={degrees}
                cx={centre + orbit * Math.cos(radians)}
                cy={centre + orbit * Math.sin(radians)}
                r={load}
                fill={colors.onAccent}
                opacity={0.9}
              />
            );
          })}
        </Svg>
      </Animated.View>
    </View>
  );
}
