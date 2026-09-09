import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ACCENTS,
  STATUS_LABELS,
  colors,
  elevation,
  space,
  type,
} from '@/components/ui-kit';
import type { OrderStatus } from '@/lib/domain/order-status';
import { cycleStanding, washCycleProgress } from '@/lib/domain/wash-cycle';
import { useReducedMotion } from '@/lib/use-reduced-motion';

type Accent = (typeof ACCENTS)[number];

/**
 * Where this customer's laundry is, in one strip.
 *
 * The shopfront used to answer this with a progress dial and a status word: an
 * unlabelled arc, ninety points tall, floating between the welcome card and
 * the price list. An arc cannot say *how much is left* — but the cycle can be
 * counted, because it is five named stages and the laundry is at one of them.
 *
 * So the dial becomes a rail whose segments **are** those five stages, and the
 * live one is drawn wider than the rest. That one move does three jobs at
 * once: it reads as a progress bar, it reads as "three of five", and the
 * widest segment lands under the word naming it. A third of the old height,
 * and it says more.
 *
 * `status: null` is the resting state — connected to this shop, nothing of
 * yours in its machines. It draws the same rail, unlit, and is not pressable,
 * because there is no order behind it to open. Hiding the strip entirely in
 * that case was worse: the one place the customer goes to ask "where is my
 * laundry" answered by showing nothing at all, which is indistinguishable
 * from the feature being missing.
 */
export function CycleStrip({
  status,
  accent,
  extraCount = 0,
  onPress,
}: {
  /** null when this customer has nothing in this shop's wash right now. */
  status: OrderStatus | null;
  /** The shop's own tone. Identity stays the shop's; state stays the rail's. */
  accent: Accent;
  /** Other loads of theirs in this shop's wash right now. */
  extraCount?: number;
  /** Omitted in the resting state: there is no order to open. */
  onPress?: () => void;
}) {
  const isResting = status === null;

  // The resting rail is the pending cycle: five stages, none of them reached.
  const { steps } = washCycleProgress(status ?? 'pending');
  const standing = cycleStanding(status ?? 'pending');

  const stageIcon = isResting
    ? 'shirt-outline'
    : steps.find((step) => step.state === 'current')?.icon ?? 'time-outline';

  const heading = isResting ? 'Nothing in the wash' : STATUS_LABELS[status];
  const caption = isResting
    ? 'Book a load below and track it here'
    : extraCount > 0
      ? `${standing.caption} · +${extraCount} more here`
      : standing.caption;

  const body = (
    <>
      <View style={styles.head}>
        <View
          style={[
            styles.mark,
            { backgroundColor: isResting ? colors.sunken : accent.surface },
          ]}
        >
          <Ionicons
            name={stageIcon as never}
            size={18}
            color={isResting ? colors.subtle : accent.ink}
          />
        </View>

        <View style={styles.words}>
          {/* Two lines, not one: at large accessibility text "Ready for
              pickup" would truncate, and the stage name is the one thing on
              the strip that must never be clipped. The caption below it may
              truncate — its full sentence is in the accessible label. */}
          <Text
            style={[styles.status, isResting && styles.statusResting]}
            numberOfLines={2}
          >
            {heading}
          </Text>
          <Text style={styles.caption} numberOfLines={1}>
            {caption}
          </Text>
        </View>

        {!isResting && (
          <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
        )}
      </View>

      <View style={styles.rail} accessible={false}>
        {steps.map((step) => (
          <RailSegment
            key={step.status}
            state={step.state}
            isRunning={standing.isRunning}
          />
        ))}
      </View>
    </>
  );

  if (isResting) {
    return (
      <View style={[styles.strip, styles.stripResting]} accessible>
        {body}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Your laundry here. ${heading}, ${standing.caption.toLowerCase()}.${
        extraCount > 0 ? ` ${extraCount} more in the wash.` : ''
      }`}
      accessibilityHint="Opens the order"
      onPress={onPress}
      style={({ pressed }) => [styles.strip, pressed && { opacity: 0.85 }]}
    >
      {body}
    </Pressable>
  );
}

/**
 * One stage of the cycle. The live segment is wider — the rail's whole trick —
 * and breathes only while a machine is genuinely turning, so the motion is a
 * fact about the laundry rather than an ornament that runs forever.
 */
function RailSegment({
  state,
  isRunning,
}: {
  state: 'done' | 'current' | 'upcoming';
  isRunning: boolean;
}) {
  const isCurrent = state === 'current';
  const isBreathing = isCurrent && isRunning;
  const isReduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!isBreathing || isReduced) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isBreathing, isReduced, pulse]);

  const background =
    state === 'done' ? colors.success : isCurrent ? colors.action : colors.border;

  return (
    <Animated.View
      style={[
        styles.segment,
        // The live stage takes more than twice the width of a passed one, so
        // the rail is a counter as much as it is a bar.
        { backgroundColor: background, flex: isCurrent ? 2.2 : 1 },
        isBreathing && { opacity: pulse },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  /**
   * The head of the price list, not a card floating above it: same radius and
   * surface as the category doors below, so the region reads as one thing.
   */
  strip: {
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy + 2,
    borderRadius: 20,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  // Resting is a fact, not an object to act on: it sits flat on the field with
  // an outline instead of a shadow, so a live load is the only strip that ever
  // lifts off the page.
  stripResting: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  // 36, not the 44 a service row uses: this is a status, not a target of its
  // own, and the whole strip is the touch target.
  mark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  words: { flex: 1 },
  status: { ...type.section, fontSize: 16, color: colors.text },
  statusResting: { color: colors.subtle },
  caption: { ...type.caption, color: colors.subtle, marginTop: 1 },
  rail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  segment: { height: 6, borderRadius: 3 },
});
