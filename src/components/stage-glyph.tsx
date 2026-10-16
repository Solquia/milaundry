/**
 * The stage, drawn the way iOS draws things: an app-icon squircle filled with
 * a glossy gradient in the stage's colour, one solid white glyph on it, and an
 * Activity-style ring around it that fills as the laundry moves down the road.
 *
 * Replaces the illustrated washing-machine door on the tracker. The drum told
 * the story with drawings; this says it with a symbol and a ring, which is how
 * the rest of the phone already talks.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useId, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { OrderStatus } from '@/lib/domain/order-status';
import { useReducedMotion } from '@/lib/use-reduced-motion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** iOS app icons round their corners at about 22.5% of the side. */
const ICON_CORNER = 0.225;
const RING_MS = 900;

/** The solid version of a journey icon: SF Symbols use `.fill` on a tile. */
function filledIcon(icon: string): string {
  return icon.replace(/-outline$/, '');
}

/** #RRGGBB lightened toward white by `amount` (0–1). */
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function StageGlyph({
  status,
  icon,
  color,
  progress,
  size = 132,
}: {
  status: OrderStatus;
  icon: string;
  color: string;
  /** How far down the road, 0–1. */
  progress: number;
  size?: number;
}) {
  const isReduced = useReducedMotion();
  const [ring] = useState(() => new Animated.Value(0));
  const [motion] = useState(() => new Animated.Value(0));

  const stroke = Math.max(6, Math.round(size * 0.075));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const tile = Math.round(size * 0.6);

  const isLive = status !== 'completed' && status !== 'cancelled';
  const isSpinning = status === 'drying';

  useEffect(() => {
    const to = Math.min(1, Math.max(0, progress));
    if (isReduced) {
      ring.setValue(to);
      return;
    }
    Animated.timing(ring, {
      toValue: to,
      duration: RING_MS,
      easing: Easing.out(Easing.cubic),
      // strokeDashoffset is not a native-driver prop.
      useNativeDriver: false,
    }).start();
  }, [progress, ring, isReduced]);

  useEffect(() => {
    if (!isLive || isReduced) {
      motion.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(motion, {
        toValue: 1,
        duration: isSpinning ? 6000 : 2600,
        easing: isSpinning ? Easing.linear : Easing.inOut(Easing.sin),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isLive, isSpinning, isReduced, motion]);

  const glyphMotion = isSpinning
    ? { transform: [{ rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }
    : {
        transform: [
          { scale: motion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.06, 1] }) },
        ],
      };

  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* The ring: a faint track, and the travelled part in the stage colour. */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeOpacity={0.14}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={ring.interpolate({
            inputRange: [0, 1],
            outputRange: [circumference, 0],
          })}
          // Start at twelve o'clock, like Activity.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>

      <GlyphTile icon={icon} color={color} size={tile} glyphStyle={glyphMotion} />
    </View>
  );
}

/** Upcoming steps: frosted white with a grey symbol, not yet in colour. */
const MUTED_FILL = 'rgba(255, 255, 255, 0.9)';
const MUTED_GLYPH = '#AEAEB2';

/**
 * One app-icon tile: a glossy gradient squircle with a solid white symbol, or,
 * muted, a frosted white tile with a grey one — a step not reached yet.
 */
export function GlyphTile({
  icon,
  color,
  size,
  isMuted = false,
  isLifted = true,
  glyphStyle,
}: {
  icon: string;
  color: string;
  size: number;
  isMuted?: boolean;
  /** A shadow in the tile's own colour. Off for small tiles in a row. */
  isLifted?: boolean;
  glyphStyle?: React.ComponentProps<typeof Animated.View>['style'];
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const corner = size * ICON_CORNER;

  return (
    <View
      style={[
        styles.tile,
        {
          width: size,
          height: size,
          borderRadius: corner,
          // Under the gradient; Android casts its shadow from this fill.
          backgroundColor: isMuted ? MUTED_FILL : color,
          shadowColor: isMuted ? '#1B2559' : color,
        },
        isMuted ? styles.mutedTile : null,
        !isLifted && !isMuted ? styles.flatTile : null,
      ]}
    >
      {isMuted ? null : (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`fill${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={lighten(color, 0.35)} />
              <Stop offset="1" stopColor={color} />
            </LinearGradient>
            <LinearGradient id={`gloss${id}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.45} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect width={size} height={size} rx={corner} fill={`url(#fill${id})`} />
          <Rect width={size} height={size / 2} rx={corner} fill={`url(#gloss${id})`} />
        </Svg>
      )}
      <Animated.View style={glyphStyle}>
        <Ionicons
          name={filledIcon(icon) as never}
          size={Math.round(size * 0.5)}
          color={isMuted ? MUTED_GLYPH : '#FFFFFF'}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
    overflow: 'visible',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  mutedTile: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 1)',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  flatTile: {
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
});
