/**
 * A number that changes by moving, not by being replaced.
 *
 * Every figure a customer actually watches in this product is a figure they
 * are *steering*: the kilos under the ruler's needle, the pieces they are
 * counting up, the estimate at the foot of the screen. Swapping the glyph
 * outright makes the biggest number on the page the one thing that does not
 * respond to the gesture driving it, and a total that flickers between two
 * values reads as a recalculation rather than as an answer.
 *
 * So each digit sits in its own slot and rolls to the one it is becoming. The
 * digit that did not change does not move — which is the whole point, and why
 * the columns are addressed from the right in `domain/brand-gradient`: 9.5
 * going to 10.0 rolls the tenths and carries the units, it does not respin the
 * whole readout.
 */
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, TextStyle, View } from 'react-native';

import { odometerCells } from '@/lib/domain/brand-gradient';
import { useReducedMotion } from '@/lib/use-reduced-motion';

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

interface OdometerProps {
  /** Already formatted — "2.0", "₱352.00". This draws it, it does not round it. */
  value: string;
  /** The type role the number is set in. Its `lineHeight` is the roll distance. */
  style: TextStyle;
  /**
   * What the whole readout says, for a screen reader. Without it the columns
   * are announced one character at a time.
   */
  label?: string;
}

export function Odometer({ value, style, label }: OdometerProps) {
  const cells = odometerCells(value);
  const height = style.lineHeight ?? (style.fontSize ?? 16) * 1.2;

  return (
    <View style={[styles.row, { height }]} accessible accessibilityLabel={label ?? value}>
      {cells.map((cell) =>
        cell.isDigit ? (
          <Digit key={cell.place} digit={Number(cell.char)} height={height} style={style} />
        ) : (
          // A decimal point or a peso sign is punctuation, not a wheel.
          <Text key={cell.place} style={[style, styles.still]}>
            {cell.char}
          </Text>
        )
      )}
    </View>
  );
}

/**
 * One wheel: ten glyphs in a slot one glyph tall.
 *
 * Sprung rather than timed, and firmly damped, so a digit dragged quickly
 * through several values keeps up with the finger instead of queueing ten
 * animations and arriving late. A spring can be redirected mid-flight; a
 * timing curve has to be cancelled and restarted.
 */
function Digit({ digit, height, style }: { digit: number; height: number; style: TextStyle }) {
  const isReduced = useReducedMotion();
  const [offset] = useState(() => new Animated.Value(digit));

  useEffect(() => {
    if (isReduced) {
      offset.setValue(digit);
      return;
    }
    const spring = Animated.spring(offset, {
      toValue: digit,
      damping: 18,
      stiffness: 220,
      mass: 0.7,
      useNativeDriver: true,
    });
    spring.start();
    return () => spring.stop();
  }, [digit, isReduced, offset]);

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Animated.View
        style={{
          transform: [
            {
              translateY: offset.interpolate({
                inputRange: [0, 9],
                outputRange: [0, -9 * height],
              }),
            },
          ],
        }}
      >
        {DIGITS.map((glyph) => (
          <Text key={glyph} style={[style, styles.still, { height }]}>
            {glyph}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', overflow: 'hidden' },
  /**
   * Lining figures of one width.
   *
   * A proportional 1 is narrower than a 7 in most faces, so a wheel carrying
   * both changes the readout's width as it turns and shoves everything beside
   * it sideways. `tabular-nums` is what stops the number from breathing.
   */
  still: { fontVariant: ['tabular-nums'], textAlign: 'center' },
});
