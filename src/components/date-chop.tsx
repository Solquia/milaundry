/**
 * The chop: the date stamp a counter inks onto a ticket when it takes the load.
 *
 * A laundry stub is not illustrated. It is stamped — a rubber chop, pressed
 * slightly crooked, the ink heavier on one edge than the other. That mark is
 * the oldest piece of interface in the business and nobody has ever needed it
 * explained. It replaced a drawing of a basket on this block, which was pretty
 * and said the same thing about every load in the list.
 *
 * Drawn rather than illustrated: two rules, a month wheel, a day wheel, and the
 * monospace a rubber die would actually cut. The tilt and the doubled ink are
 * what keep it from reading as a badge — a badge is printed with the ticket, a
 * chop is pressed onto it afterwards by a person.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { mono, space } from './ui-kit';
import type { Chop } from '@/lib/domain/ticket-stamp';

/** How crooked. Enough to read as pressed by hand, not enough to look broken. */
const TILT = '-7deg';

interface DateChopProps {
  chop: Chop;
  /** The ink. White on a shop's colour block; the shop's own ink on paper. */
  ink: string;
  /**
   * What the chop says, spoken. The stub already says the date in its own
   * label, so by default the mark is decoration to a screen reader.
   */
  label?: string;
}

export function DateChop({ chop, ink, label }: DateChopProps) {
  const body = (
    <View style={[styles.frame, { borderColor: ink }]}>
      <View style={[styles.inner, { borderColor: ink }]}>
        <Text style={[styles.month, { color: ink }]}>{chop.month}</Text>
        <Text style={[styles.day, { color: ink }]}>{chop.day}</Text>
        <View style={[styles.rule, { backgroundColor: ink }]} />
        <Text style={[styles.year, { color: ink }]}>{chop.year}</Text>
      </View>
    </View>
  );

  return (
    <View
      style={styles.stage}
      accessible={Boolean(label)}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    >
      {/* The bleed: the same mark, a hair off register and barely inked. It is
          what a rubber stamp does when the hand rocks, and it is the whole
          difference between "stamped" and "drawn". */}
      <View style={[StyleSheet.absoluteFill, styles.bleed]} pointerEvents="none">
        {body}
      </View>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { transform: [{ rotate: TILT }] },
  /** Offset by a pixel and mostly transparent: ink, not a shadow. */
  bleed: { opacity: 0.35, transform: [{ translateX: 1.5 }, { translateY: 1 }] },
  frame: {
    borderWidth: 2,
    borderRadius: 8,
    padding: 2.5,
    opacity: 0.92,
  },
  inner: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: space.snug,
    paddingVertical: space.tight,
    alignItems: 'center',
  },
  /** Opened right up: a die cuts its month wide because the die is wide. */
  month: { fontFamily: mono, fontSize: 10, letterSpacing: 2, lineHeight: 13 },
  day: { fontFamily: mono, fontSize: 21, fontWeight: '700', lineHeight: 24 },
  rule: { height: 1, alignSelf: 'stretch', marginVertical: 2, opacity: 0.8 },
  year: { fontFamily: mono, fontSize: 9, letterSpacing: 1, lineHeight: 11 },
});
