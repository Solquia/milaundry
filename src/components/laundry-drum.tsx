import React, { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { OrderStatus } from '@/lib/domain/order-status';
import { useReducedMotion } from '@/lib/use-reduced-motion';

import { DrumBackdrop, Garment, StageScene, type GarmentKind } from './stage-scene';
import { colors, elevation } from './ui-kit';

/** The three pieces tumbling in a running drum. */
const LOAD: readonly GarmentKind[] = ['tee', 'sock', 'towel'];

/** One lap of the load inside the drum. Drying spins harder than washing. */
const WASH_LAP_MS = 4200;
const DRY_LAP_MS = 1800;
/** A gentle breath for a stage where nothing is turning. */
const BREATHE_MS = 2400;
const BUBBLE_MS = 2600;

type DrumMode = 'wash' | 'dry' | 'still';

function drumMode(status: OrderStatus): DrumMode {
  if (status === 'washing') return 'wash';
  if (status === 'drying') return 'dry';
  return 'still';
}

/** A #RRGGBB colour at some alpha, as #RRGGBBAA. */
export function tint(hex: string, alpha: number): string {
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex}${channel}`;
}

/** A driver that runs 0 → 1 forever, or sits at 0 when motion is off. */
function useLoop(isRunning: boolean, durationMs: number, delayMs = 0): Animated.Value {
  const isReduced = useReducedMotion();
  const [value] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!isRunning || isReduced) {
      value.stopAnimation();
      value.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.timing(value, {
          toValue: 1,
          duration: durationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isRunning, isReduced, durationMs, delayMs, value]);

  return value;
}

/**
 * The stage, shown as a washing machine's porthole.
 *
 * A badge that says "Washing" has to be read; a drum with water sloshing in it
 * is understood from across the room. The door shows what is really happening:
 * clothes tumble through water while washing, spin hard and dry while drying,
 * and every other stage holds its own glyph still in the glass. Motion is a
 * readout — a drum only turns when a machine is actually running.
 */
export function LaundryDrum({
  status,
  icon,
  color,
  size = 152,
  isIdle = false,
}: {
  status: OrderStatus;
  icon: string;
  color: string;
  size?: number;
  /** Nothing of the customer's is in the machine: no motion at all. */
  isIdle?: boolean;
}) {
  const mode = isIdle ? 'still' : drumMode(status);
  const isStill = mode === 'still';
  const glass = Math.round(size * 0.74);
  const ringWidth = Math.max(3, Math.round(size * 0.06));
  const handleWidth = Math.max(4, Math.round(size * 0.05));

  const lap = useLoop(!isStill, mode === 'dry' ? DRY_LAP_MS : WASH_LAP_MS);
  const breathe = useLoop(
    isStill && !isIdle && status !== 'cancelled' && status !== 'completed',
    BREATHE_MS
  );

  const tumble = lap.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // A rounded square looks the same every quarter turn, so a 90° sweep loops
  // without a seam and reads as a lazy slosh.
  const slosh = lap.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  const sloshBack = lap.interpolate({ inputRange: [0, 1], outputRange: ['45deg', '-45deg'] });
  const breath = breathe.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });

  const water = glass * 1.6;
  const orbit = glass * 0.26;

  return (
    <View
      style={[
        styles.door,
        elevation.lift,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ringWidth,
          borderColor: color,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {/* The handle, so the circle reads as a machine's door and not a badge. */}
      <View
        style={[
          styles.handle,
          {
            backgroundColor: color,
            width: handleWidth,
            borderRadius: handleWidth / 2,
            right: -ringWidth - size * 0.05,
            height: size * 0.26,
          },
        ]}
      />

      <View
        style={[
          styles.glass,
          {
            width: glass,
            height: glass,
            borderRadius: glass / 2,
            backgroundColor: tint(color, mode === 'dry' ? 0.14 : 0.08),
          },
        ]}
      >
        <View style={StyleSheet.absoluteFill}>
          <DrumBackdrop color={color} size={glass} isWarm={mode === 'dry'} />
        </View>
        {mode === 'wash' ? (
          <>
            <Animated.View
              style={[
                styles.water,
                {
                  width: water,
                  height: water,
                  borderRadius: water * 0.42,
                  left: (glass - water) / 2,
                  top: glass * 0.46,
                  backgroundColor: tint(color, 0.22),
                  transform: [{ rotate: sloshBack }],
                },
              ]}
            />
            <Animated.View
              style={[
                styles.water,
                {
                  width: water,
                  height: water,
                  borderRadius: water * 0.4,
                  left: (glass - water) / 2,
                  top: glass * 0.52,
                  backgroundColor: tint(color, 0.32),
                  transform: [{ rotate: slosh }],
                },
              ]}
            />
            {[0.28, 0.52, 0.72].map((x, index) => (
              <Bubble key={x} glass={glass} x={x} delayMs={index * 800} color={color} />
            ))}
          </>
        ) : null}

        {isStill ? (
          <Animated.View style={{ transform: [{ scale: breath }] }}>
            <StageScene icon={icon} color={color} size={glass * 0.9} />
          </Animated.View>
        ) : (
          <Animated.View
            style={[StyleSheet.absoluteFill, styles.center, { transform: [{ rotate: tumble }] }]}
          >
            {[0, 120, 240].map((degrees, index) => {
              const radians = (degrees * Math.PI) / 180;
              return (
                <View
                  key={degrees}
                  style={[
                    styles.load,
                    {
                      transform: [
                        { translateX: orbit * Math.cos(radians) },
                        { translateY: orbit * Math.sin(radians) },
                        { rotate: `${degrees + 30}deg` },
                      ],
                    },
                  ]}
                >
                  <Garment kind={LOAD[index]} color={color} size={glass * 0.3} />
                </View>
              );
            })}
          </Animated.View>
        )}
      </View>

      {/* The glint on the glass, a quarter-moon of light at ten o'clock. */}
      <View
        style={[
          styles.glint,
          {
            width: glass * 0.34,
            height: glass * 0.16,
            borderRadius: glass,
            top: (size - glass) / 2 - ringWidth + glass * 0.12,
            left: (size - glass) / 2 - ringWidth + glass * 0.14,
          },
        ]}
      />
    </View>
  );
}

function Bubble({
  glass,
  x,
  delayMs,
  color,
}: {
  glass: number;
  x: number;
  delayMs: number;
  color: string;
}) {
  const rise = useLoop(true, BUBBLE_MS, delayMs);
  const dot = Math.max(5, glass * 0.06);

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          borderColor: tint(color, 0.6),
          left: glass * x,
          top: glass * 0.82,
          opacity: rise.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
          transform: [
            {
              translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [0, -glass * 0.42] }),
            },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  door: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  handle: { position: 'absolute' },
  glass: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  water: { position: 'absolute' },
  load: { position: 'absolute' },
  bubble: { position: 'absolute', borderWidth: 1.5 },
  glint: {
    position: 'absolute',
    pointerEvents: 'none',
    backgroundColor: 'rgba(255,255,255,0.7)',
    transform: [{ rotate: '-35deg' }],
  },
});
