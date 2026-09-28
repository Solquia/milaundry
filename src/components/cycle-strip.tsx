import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { LaundryDrum, tint } from '@/components/laundry-drum';
import {
  ACCENTS,
  RADII,
  STATUS_COLORS,
  STATUS_LABELS,
  colors,
  elevation,
  space,
  type,
} from '@/components/ui-kit';
import type { OrderStatus } from '@/lib/domain/order-status';
import { cycleStanding, washCycleProgress, type WashCycleStep } from '@/lib/domain/wash-cycle';
import { useReducedMotion } from '@/lib/use-reduced-motion';

type Accent = (typeof ACCENTS)[number];

const DRUM_SIZE = 54;

/** What the customer does or waits for after the stage they are at. */
function nextLine(status: OrderStatus, steps: WashCycleStep[]): string {
  if (status === 'pending') return 'Next: drop it off at the shop';
  if (status === 'ready') return 'Come collect it';
  const index = steps.findIndex((step) => step.state === 'current');
  const next = index >= 0 ? steps[index + 1] : undefined;
  return next ? `Next: ${next.label.toLowerCase()}` : '';
}

/**
 * Where this customer's laundry is, in one strip — the pocket version of the
 * tracker on the order screen.
 *
 * Same machine door, same stage colours, so the strip and the order it opens
 * read as one thing: the drum tumbles while a machine is actually running,
 * the rail's segments are the five stages with the live one drawn wider, and
 * the line under the stage name says what comes next rather than repeating
 * the count the rail already shows.
 *
 * `status: null` is the resting state — connected to this shop, nothing of
 * yours in its machines. It draws the same strip, unlit and still, and is not
 * pressable, because there is no order behind it to open. Hiding it entirely
 * made the place a customer looks for their laundry indistinguishable from
 * the feature being missing.
 */
export function CycleStrip({
  status,
  accent,
  extraCount = 0,
  onPress,
}: {
  /** null when this customer has nothing in this shop's wash right now. */
  status: OrderStatus | null;
  /** The shop's own tone, used for the resting door. */
  accent: Accent;
  /** Other loads of theirs in this shop's wash right now. */
  extraCount?: number;
  /** Omitted in the resting state: there is no order to open. */
  onPress?: () => void;
}) {
  const isResting = status === null;
  const live = status ?? 'pending';

  const { steps } = washCycleProgress(live);
  const standing = cycleStanding(live);
  const color = isResting ? colors.subtle : STATUS_COLORS[live];

  const stageIcon = isResting
    ? 'shirt-outline'
    : live === 'pending'
      ? 'receipt-outline'
      : (steps.find((step) => step.state === 'current')?.icon ?? 'time-outline');

  const heading = isResting ? 'Nothing in the wash' : STATUS_LABELS[live];
  const next = isResting ? 'Book a load below and track it here' : nextLine(live, steps);

  const body = (
    <>
      <View style={styles.head}>
        <LaundryDrum
          status={live}
          icon={stageIcon}
          color={isResting ? accent.ink : color}
          size={DRUM_SIZE}
          isIdle={isResting}
        />

        <View style={styles.words}>
          <View style={styles.titleRow}>
            {/* Two lines, not one: at large accessibility text "Ready for
                pickup" would truncate, and the stage name is the one thing
                on the strip that must never be clipped. */}
            <Text style={[styles.status, isResting && styles.statusResting]} numberOfLines={2}>
              {heading}
            </Text>
            {!isResting && standing.position > 0 && (
              <Text style={[styles.standing, { color }]}>
                {standing.position}/{standing.total}
              </Text>
            )}
          </View>
          {next ? (
            <Text style={styles.caption} numberOfLines={1}>
              {next}
            </Text>
          ) : null}
          {extraCount > 0 && (
            <Text style={styles.caption} numberOfLines={1}>
              +{extraCount} more of yours here
            </Text>
          )}
        </View>

        {!isResting && (
          <View style={[styles.track, { backgroundColor: tint(color, 0.12) }]}>
            <Text style={[styles.trackText, { color }]}>Track</Text>
            <Ionicons name="chevron-forward" size={14} color={color} />
          </View>
        )}
      </View>

      <View style={styles.rail} accessible={false}>
        {steps.map((step) => (
          <RailSegment
            key={step.status}
            state={step.state}
            color={color}
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
        next ? ` ${next}.` : ''
      }${extraCount > 0 ? ` ${extraCount} more in the wash.` : ''}`}
      accessibilityHint="Opens the order tracker"
      onPress={onPress}
      style={({ pressed }) => [
        styles.strip,
        { borderColor: tint(color, 0.25) },
        pressed && styles.pressed,
      ]}
    >
      {body}
    </Pressable>
  );
}

/**
 * One stage of the cycle, in the stage's own colour: passed stages solid, the
 * live one wider, and breathing only while a machine is genuinely turning.
 */
function RailSegment({
  state,
  color,
  isRunning,
}: {
  state: 'done' | 'current' | 'upcoming';
  color: string;
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
    state === 'done' ? tint(color, 0.55) : isCurrent ? color : colors.border;

  return (
    <Animated.View
      style={[
        styles.segment,
        { backgroundColor: background, flex: isCurrent ? 2.2 : 1 },
        isBreathing && { opacity: pulse },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  strip: {
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy + 2,
    borderRadius: RADII.card,
    borderWidth: 1,
    backgroundColor: colors.card,
    ...elevation.lift,
  },
  // Resting is a fact, not an object to act on: flat on the field with an
  // outline, so a live load is the only strip that ever lifts off the page.
  stripResting: {
    backgroundColor: 'transparent',
    borderColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  words: { flex: 1, gap: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.snug },
  status: { ...type.section, fontSize: 17, color: colors.text, flexShrink: 1 },
  statusResting: { color: colors.subtle },
  standing: { ...type.caption, fontFamily: type.label.fontFamily },
  caption: { ...type.caption, color: colors.subtle },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingLeft: space.cosy,
    paddingRight: space.snug,
    paddingVertical: 6,
    borderRadius: RADII.pill,
  },
  trackText: { ...type.label },
  rail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  segment: { height: 6, borderRadius: 3 },
});
