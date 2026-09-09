import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { STATUS_COLORS, colors, elevation, space, type } from '@/components/ui-kit';
import type { OrderStatus } from '@/lib/domain/order-status';
import { washCycleProgress, type WashCycleStep } from '@/lib/domain/wash-cycle';

/**
 * Where the laundry is, as a row of stages rather than a sentence.
 *
 * It lived inside the home screen's tracker card, which meant the order detail
 * — the screen someone opens *because* they want to know — had only a badge.
 * One component now, so the two surfaces cannot disagree about which stage is
 * lit.
 */
/**
 * The colour of where the laundry is right now.
 *
 * The tracker used to paint every stage in `colors.action` — the blue that
 * means "you can act here" — so the one element on the screen that is entirely
 * *about* state was spending its colour on the wrong idea, while the app's own
 * status ramp (received blue → washing purple → drying orange → folded teal →
 * ready green) sat unused two files away.
 *
 * Reading the ramp here means the badge and the tracker can never disagree, and
 * that the cycle *changes colour as the laundry moves*: the customer can tell
 * washing from drying across the room, before a word is read.
 */
export function WashCycleTracker({ status }: { status: OrderStatus }) {
  const progress = washCycleProgress(status);
  const stageColor = STATUS_COLORS[status];
  // Booked, but the laundry is not in the shop's hands yet, so no dot is lit.
  const hasNotStarted =
    !progress.isCancelled && progress.steps.every((step) => step.state === 'upcoming');

  return (
    <View style={styles.tracker}>
      <View
        style={styles.progressTrack}
        accessibilityRole="progressbar"
        accessibilityLabel="Wash progress"
        accessibilityValue={{ now: progress.percent, min: 0, max: 100 }}
      >
        <View
          style={[
            styles.progressFill,
            { width: `${progress.percent}%`, backgroundColor: stageColor },
          ]}
        />
      </View>

      <View style={styles.stageRow}>
        {progress.steps.map((step) => (
          <StageDot key={step.status} step={step} stageColor={stageColor} />
        ))}
      </View>

      {/*
        The card asks "where your laundry is" and, before the cycle begins,
        used to answer with five grey dots and an empty bar — a question mark
        the customer has to interpret. Nothing is lit because nothing has
        happened yet, and that is a fact worth saying in words.
        Only when no stage is lit: mid-cycle the highlighted dot is the answer,
        and a sentence repeating it would be noise on every visit.
      */}
      {progress.isCancelled ? (
        <Text style={styles.note}>This order was cancelled.</Text>
      ) : hasNotStarted ? (
        <Text style={styles.note}>
          The shop hasn&apos;t received your laundry yet.
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The journey behind the laundry is one colour — the colour of where it is now
 * — and the stages ahead of it are grey. Done stages used to be green while the
 * live one was blue, which made a load mid-cycle read as two unrelated runs of
 * colour rather than as one road with a position on it.
 *
 * Colour is never the only code: a finished stage carries a checkmark, and the
 * live one carries its own glyph, a lift off the card, and a bold label.
 */
function StageDot({ step, stageColor }: { step: WashCycleStep; stageColor: string }) {
  const isDone = step.state === 'done';
  const isCurrent = step.state === 'current';
  const isReached = isDone || isCurrent;
  const iconColor = isReached ? colors.onAccent : colors.subtle;

  return (
    <View style={styles.stage}>
      <View
        style={[
          styles.stageDot,
          { backgroundColor: isReached ? stageColor : colors.bg },
          isCurrent && styles.stageDotCurrent,
        ]}
      >
        <Ionicons
          name={(isDone ? 'checkmark' : step.icon) as never}
          size={15}
          color={iconColor}
        />
      </View>
      <Text
        style={[
          styles.stageLabel,
          isCurrent && [styles.stageLabelCurrent, { color: stageColor }],
        ]}
        numberOfLines={1}
      >
        {step.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tracker: { gap: space.room },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    // The unfilled road, one step darker than the card's own field so the
    // track reads as a groove rather than as a gap between two things.
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  // Colour arrives inline, from the status ramp: this is the road travelled.
  progressFill: { height: 6, borderRadius: 3 },
  stageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stage: { flex: 1, alignItems: 'center', gap: space.snug },
  stageDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The live stage is the one thing on the card worth lifting off it.
  stageDotCurrent: elevation.lift,
  stageLabel: { ...type.caption, color: colors.subtle, textAlign: 'center' },
  // The hue is applied inline; this carries only the weight.
  stageLabelCurrent: { fontWeight: '700' },
  note: { ...type.caption, color: colors.subtle },
});
