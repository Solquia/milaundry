/**
 * The blue the home stands on.
 *
 * Not a gradient behind a card — the field *is* the page. A deep cobalt ground
 * with two soft blooms of light drifting across it on a slow loop, so the
 * colour is never quite still and never quite the same twice. Everything the
 * customer actually reads rides on a white sheet over the top of it.
 *
 * The blooms are the only moving parts, and they move the cheap way: two
 * `Animated.View`s carrying a pre-rendered radial fill, driven by transform
 * and nothing else, on the native driver. No per-frame layout, no re-render,
 * no gradient interpolation — a slow breath the GPU can hold at 60fps on a
 * cheap phone, and a still field the moment the device asks for less motion.
 *
 * Used by the customer's home and by a shop's own web page, so the two open on
 * the same light.
 */
import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Defs,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
} from 'react-native-svg';

import { BLUE_FIELD } from './ui-kit';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/** One full breath of the drift, out and back. */
const DRIFT_MS = 11000;
/** How far a bloom wanders, as a share of the field it sits in. */
const WANDER = 0.12;

interface BloomProps {
  /** Where it rests, in shares of the field. */
  x: number;
  y: number;
  /** How wide the light pool is, as a share of the field's width. */
  size: number;
  colour: string;
  id: string;
  drift: Animated.Value;
  /** Which way it wanders, so the two blooms never move as one object. */
  direction: 1 | -1;
  width: number;
  height: number;
}

function Bloom({ x, y, size, colour, id, drift, direction, width, height }: BloomProps) {
  const diameter = width * size;
  const travel = width * WANDER * direction;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: width * x - diameter / 2,
        top: height * y - diameter / 2,
        width: diameter,
        height: diameter,
        transform: [
          { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, travel] }) },
          {
            translateY: drift.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -travel * 0.6],
            }),
          },
          { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) },
        ],
      }}
    >
      <Svg width={diameter} height={diameter}>
        <Defs>
          <SvgRadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colour} stopOpacity={0.85} />
            <Stop offset="0.55" stopColor={colour} stopOpacity={0.3} />
            <Stop offset="1" stopColor={colour} stopOpacity={0} />
          </SvgRadialGradient>
        </Defs>
        <Rect x={0} y={0} width={diameter} height={diameter} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

interface BlueFieldProps {
  /**
   * The box to paint, when the caller already knows it. Left out, the field
   * measures itself and falls back to the window until that lands — SVG cannot
   * size in percentages against a flex parent, and a field that waits for a
   * layout pass that never comes is a flat rectangle.
   */
  width?: number;
  height?: number;
  style?: ViewStyle;
  /**
   * Laid over the blooms, under the content. A shop's page passes its cover
   * photograph here, so the picture is graded into the same blue.
   */
  children?: React.ReactNode;
}

export function BlueField({ width, height, style, children }: BlueFieldProps) {
  const isReduced = useReducedMotion();
  const window = useWindowDimensions();
  const [box, setBox] = useState({ width: 0, height: 0 });
  const paintWidth = width ?? (box.width || window.width);
  const paintHeight = height ?? (box.height || window.height);
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (isReduced) {
      // Mid-drift, not zero: the still field should be the handsome frame of
      // the loop rather than the one it happens to start on.
      drift.setValue(0.5);
      return;
    }
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: DRIFT_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: DRIFT_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    breathe.start();
    return () => breathe.stop();
  }, [drift, isReduced]);

  return (
    // The ground colour is on the View itself, so the field is deep blue for
    // the frame before the SVG paints and at any edge it antialiases past.
    <View
      style={[styles.field, { backgroundColor: BLUE_FIELD.deep }, style]}
      pointerEvents="none"
      onLayout={(event) => {
        const { width: w, height: h } = event.nativeEvent.layout;
        setBox((current) => (current.width === w && current.height === h ? current : { width: w, height: h }));
      }}
    >
      {paintWidth > 0 && paintHeight > 0 ? (
        <>
          <Svg style={StyleSheet.absoluteFill} width={paintWidth} height={paintHeight}>
            <Defs>
              {/* Lower left to upper right: the lit corner is the one the eye
                  reaches first, and the depth pools under the reading. */}
              <SvgLinearGradient id="blueFieldGround" x1="0" y1="1" x2="1" y2="0">
                <Stop offset="0" stopColor={BLUE_FIELD.deep} />
                <Stop offset="0.5" stopColor={BLUE_FIELD.mid} />
                <Stop offset="1" stopColor={BLUE_FIELD.lit} />
              </SvgLinearGradient>
            </Defs>
            <Rect x={0} y={0} width={paintWidth} height={paintHeight} fill="url(#blueFieldGround)" />
          </Svg>

          {/* Cyan high, violet low: the two ends of the brand's own blue, far
              enough apart to read as light rather than as a second colour. */}
          <Bloom
            id="blueFieldBloomHigh"
            x={0.82}
            y={0.1}
            size={1.05}
            colour={BLUE_FIELD.bloom}
            drift={drift}
            direction={-1}
            width={paintWidth}
            height={paintHeight}
          />
          <Bloom
            id="blueFieldBloomLow"
            x={0.06}
            y={0.58}
            size={1.25}
            colour={BLUE_FIELD.glow}
            drift={drift}
            direction={1}
            width={paintWidth}
            height={paintHeight}
          />
        </>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' },
});
