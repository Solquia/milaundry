/**
 * The numbered rail across the top of a booking.
 *
 * "1. Items   2. Schedule   3. Review" — the step you are on underlined in the
 * brand colour, the ones behind you underlined too and still tappable, the
 * ones ahead greyed. It replaces the flat progress bars both booking flows
 * used to carry, which filled left to right and said nothing about how many
 * questions were left or what they would ask.
 *
 * Which tab is which state, and which may be tapped, is `step-rail.ts` — two
 * screens draw this rail and a rule that lived in one of them is a rule the
 * other would eventually break.
 *
 * The rail is a header first and a control second: a customer who never
 * touches it still gets a count and a name, which is most of its value.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { stepAnnouncement, stepRail, type StepSpec } from '@/lib/domain/step-rail';

import { colors, space, type } from './ui-kit';

/**
 * The three colours a rail needs. A storefront swaps `reached` for the shop's
 * own accent; everything else stays the app's neutral, so a pale brand cannot
 * make the unreached steps unreadable.
 */
export interface RailTone {
  /** Ink and underline for the step you are on and the ones behind it. */
  reached: string;
  /** Ink for a step still ahead. */
  ahead: string;
  /** The rule under a step still ahead. */
  track: string;
}

export const RAIL_TONE: RailTone = {
  reached: colors.actionInk,
  ahead: colors.subtle,
  track: colors.border,
};

interface StepRailProps<K extends string> {
  steps: readonly StepSpec<K>[];
  current: K;
  /** Tapping a finished step. Omitted, the rail is a header and nothing else. */
  onGo?: (step: K) => void;
  tone?: RailTone;
}

export function StepRail<K extends string>({
  steps,
  current,
  onGo,
  tone = RAIL_TONE,
}: StepRailProps<K>) {
  const tabs = stepRail(steps, current);

  return (
    // The underline is invisible to a screen reader and the numbers alone
    // leave it counting tabs, so the rail states its own position once.
    <View style={styles.rail} accessibilityLabel={stepAnnouncement(steps, current)}>
      {tabs.map((tab) => {
        const isReached = tab.state !== 'upcoming';
        const ink = isReached ? tone.reached : tone.ahead;
        const rule = isReached ? tone.reached : tone.track;
        const canGo = tab.canGo && Boolean(onGo);

        const body = (
          <>
            <Text
              numberOfLines={1}
              style={[styles.label, { color: ink }, tab.state === 'current' && styles.labelHere]}
            >
              {tab.label}
            </Text>
            <View style={[styles.rule, { backgroundColor: rule }]} />
          </>
        );

        // A step you cannot reach is not a button. Rendering it as one gives a
        // screen reader three controls where only one of them does anything.
        if (!canGo) {
          return (
            <View key={tab.key} style={styles.tab}>
              {body}
            </View>
          );
        }

        return (
          <Pressable
            key={tab.key}
            accessibilityRole="button"
            accessibilityLabel={`Go back to ${tab.label}`}
            onPress={() => onGo?.(tab.key)}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          >
            {body}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Equal columns, so the rule under each step measures the same progress. */
  rail: { flexDirection: 'row', gap: space.snug },
  tab: { flex: 1, gap: space.snug },
  tabPressed: { opacity: 0.6 },
  label: { ...type.caption },
  /** The step you are on is the only one set in the heavier cut. */
  labelHere: { fontFamily: type.label.fontFamily },
  /** 3px: a hairline reads as a divider, a bar this weight reads as progress. */
  rule: { height: 3, borderRadius: 2 },
});
