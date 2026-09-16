/**
 * Choosing when: the days on one line, the hours on the next.
 *
 * This was a month grid — seven columns, six rows, a month label and two
 * paging arrows — drawn once for the pickup and again for the delivery. Nine
 * rows of squares, twice, to answer a question that is nearly always "today"
 * or "tomorrow", and most of those squares were greyed days the shop would
 * not take anyway. The customer had to read a calendar to find tomorrow.
 *
 * So the days are a rail now, in order of nearness: the likeliest answer sits
 * first, the rest are a swipe away, and only bookable days are on it. Which
 * days those are, and what each card says, is `domain/day-rail.ts`. The hours
 * run on their own line underneath in the same gesture — no tap to reveal
 * them, because a control you must open to see is a control you must remember.
 *
 * Sideways is how this product asks for a quantity already: the weight ruler
 * and the piece counter both swipe. The date is now the third.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BOOKING_WINDOW_DAYS, hourLabel, slotSummary, type Slot } from '@/lib/domain/booking-slot';
import { railDays, railIndexOf, type RailDay } from '@/lib/domain/day-rail';
import { RADII } from '@/lib/domain/design-scale';
import { useReducedMotion } from '@/lib/use-reduced-motion';

import { colors, space, type } from './ui-kit';

/** The hours a rider calls. Two-hourly from eight to six. */
export const SLOT_HOURS = [8, 10, 12, 14, 16, 18];

/** One card, and the gap after it. The rail scrolls by exactly this much. */
const CARD_WIDTH = 68;
const CARD_GAP = space.snug;
const CARD_STRIDE = CARD_WIDTH + CARD_GAP;

/** The accent a picker borrows. A storefront passes its own shop's. */
export interface SlotTone {
  accent: string;
  onAccent: string;
  accentSoft: string;
}

export const SLOT_TONE: SlotTone = {
  accent: colors.action,
  onAccent: colors.onAccent,
  accentSoft: colors.actionSurface,
};

interface SlotCalendarProps {
  /** "Pickup" or "Delivered back". */
  label: string;
  value: Slot;
  onChange: (next: Slot) => void;
  /** Earliest day offered. 0 for pickup; the pickup's own day for delivery. */
  minOffset?: number;
  maxOffset?: number;
  now?: Date;
  tone?: SlotTone;
  /**
   * False where a caller already names this leg and states its answer — the
   * app's schedule step opens each leg from a row that does exactly that, and
   * a heading here would say it twice.
   */
  showHeading?: boolean;
  /**
   * False where this already sits inside a bordered surface. The app's
   * schedule step opens each leg into a tinted panel inside a bordered group
   * inside a card — a fourth box drawn around the chips only made the step
   * look busier than the two questions it actually asks.
   */
  framed?: boolean;
}

export function SlotCalendar({
  label,
  value,
  onChange,
  minOffset = 0,
  maxOffset = BOOKING_WINDOW_DAYS,
  now = new Date(),
  tone = SLOT_TONE,
  showHeading = true,
  framed = true,
}: SlotCalendarProps) {
  const days = railDays(minOffset, maxOffset, now);

  return (
    <View style={framed ? styles.frame : styles.bare}>
      {showHeading ? (
        <View style={styles.heading}>
          <Text style={styles.headingLabel}>{label}</Text>
          {/* The whole answer in one line, so the leg reads as a sentence even
              when both its controls are scrolled away from their marks. */}
          <Text style={[styles.headingValue, { color: tone.accent }]} numberOfLines={1}>
            {slotSummary(value, now)}
          </Text>
        </View>
      ) : null}

      <DayRail
        days={days}
        selected={value.dayOffset}
        label={label}
        tone={tone}
        onPick={(dayOffset) => onChange({ ...value, dayOffset })}
      />

      <View style={styles.hoursBlock}>
        <Text style={styles.rowLabel}>Time</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hours}
        >
          {SLOT_HOURS.map((hour) => {
            const isOn = hour === value.hour;
            return (
              <Pressable
                key={hour}
                accessibilityRole="button"
                accessibilityState={{ selected: isOn }}
                accessibilityLabel={`${label} at ${hourLabel(hour)}`}
                onPress={() => onChange({ ...value, hour })}
                style={[
                  styles.hour,
                  isOn && {
                    backgroundColor: tone.accent,
                    borderColor: tone.accent,
                    shadowColor: tone.accent,
                    ...styles.hourOn,
                  },
                ]}
              >
                <Text style={[styles.hourText, isOn && { color: tone.onAccent }]}>
                  {hourLabel(hour)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

/**
 * The days, on one line you swipe.
 *
 * It opens showing the chosen day rather than at the left edge, because a
 * delivery already set for next week would otherwise open on a rail whose
 * every visible card is the wrong one. It follows the value when something
 * else moves it too — moving the pickup past the delivery nudges the delivery,
 * and the rail has to go with it rather than keep pointing at a day that is no
 * longer set.
 */
function DayRail({
  days,
  selected,
  label,
  tone,
  onPick,
}: {
  days: readonly RailDay[];
  selected: number;
  label: string;
  tone: SlotTone;
  onPick: (dayOffset: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const hasOpened = useRef(false);
  const index = railIndexOf(days, selected);

  useEffect(() => {
    if (index < 0) return;
    // One card of run-up, so the chosen day never sits flush against the edge
    // looking like the first one there is.
    const x = Math.max(0, (index - 1) * CARD_STRIDE);
    scrollRef.current?.scrollTo({ x, animated: hasOpened.current });
    hasOpened.current = true;
  }, [index]);

  if (days.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No days left in the booking window.</Text>
      </View>
    );
  }

  return (
    <View style={styles.railBlock}>
      <Text style={styles.rowLabel}>Date</Text>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_STRIDE}
        decelerationRate="fast"
        contentContainerStyle={styles.rail}
      >
        {days.map((day) => (
          <DayCard
            key={day.dayOffset}
            day={day}
            isOn={day.dayOffset === selected}
            label={label}
            tone={tone}
            onPress={() => onPick(day.dayOffset)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/** One day, which gives under the finger the way the piece counter does. */
function DayCard({
  day,
  isOn,
  label,
  tone,
  onPress,
}: {
  day: RailDay;
  isOn: boolean;
  label: string;
  tone: SlotTone;
  onPress: () => void;
}) {
  const isReduced = useReducedMotion();
  const [press] = useState(() => new Animated.Value(1));

  const springTo = (toValue: number) => {
    if (isReduced) return;
    Animated.spring(press, {
      toValue,
      damping: 15,
      stiffness: 320,
      mass: 0.5,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: press }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected: isOn }}
        accessibilityLabel={`${label} ${day.lead}${day.month ? ` ${day.month}` : ''} ${day.dayOfMonth}`}
        onPressIn={() => springTo(0.94)}
        onPressOut={() => springTo(1)}
        onPress={onPress}
        style={[
          styles.card,
          // Today, unchosen, is ringed rather than filled, so it is never
          // mistaken for the day actually picked.
          day.isToday && !isOn && { borderColor: tone.accent },
          isOn && {
            backgroundColor: tone.accent,
            borderColor: tone.accent,
            shadowColor: tone.accent,
            ...styles.cardOn,
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.cardLead, isOn && { color: tone.onAccent, ...styles.cardLeadOn }]}
        >
          {day.lead}
        </Text>
        <Text style={[styles.cardDay, isOn && { color: tone.onAccent }]}>{day.dayOfMonth}</Text>
        {/* Only where the month turns over — and a blank line where it does
            not, so a card carrying one is not taller than its neighbours. */}
        <Text style={[styles.cardMonth, isOn && { color: tone.onAccent }]}>{day.month ?? ' '}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADII.control,
    backgroundColor: colors.card,
    paddingVertical: space.cosy,
    gap: space.cosy,
  },
  /** Embedded: the surface around it is already drawn, so this draws none. */
  bare: { gap: space.cosy },

  /** The leg's name, and the answer it currently holds, on one line. */
  heading: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.snug,
    paddingHorizontal: space.cosy,
  },
  headingLabel: { ...type.label, color: colors.text },
  headingValue: { ...type.caption, fontFamily: type.label.fontFamily, flexShrink: 1 },

  /**
   * Tight to the row it names — four against the twelve between the two rows,
   * so date and time read as two groups rather than four loose lines.
   */
  railBlock: { gap: space.tight },
  hoursBlock: { gap: space.tight },
  rowLabel: { ...type.caption, color: colors.subtle, paddingHorizontal: space.cosy },

  rail: { flexDirection: 'row', gap: CARD_GAP, paddingHorizontal: space.cosy, paddingVertical: 2 },
  card: {
    width: CARD_WIDTH,
    paddingVertical: space.snug,
    borderRadius: RADII.chip,
    // A hairline, not a 2pt rule. Ten cards on a rail drawn in double-weight
    // border read as a grid of boxes; the selected day is told by its fill.
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: 'center',
    gap: 1,
  },
  /**
   * The chosen day sits up off the rail, but by a shade rather than a flare.
   * The old lift threw the accent hue at 30% behind every selected chip, which
   * on a step holding two of them was two blue glows arguing with the button.
   */
  cardOn: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLead: { ...type.caption, fontSize: 11, color: colors.subtle },
  cardLeadOn: { fontFamily: type.label.fontFamily },
  /** One step down from `value`: still the biggest thing on the card, without
      setting a date chip in the same face as the screen's total. */
  cardDay: { ...type.section, color: colors.text },
  cardMonth: { ...type.caption, fontSize: 10, color: colors.subtle },

  hours: {
    flexDirection: 'row',
    gap: space.snug,
    paddingHorizontal: space.cosy,
    paddingVertical: 2,
  },
  hour: {
    minWidth: 64,
    minHeight: 40,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.chip,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  hourOn: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
  },
  hourText: { ...type.label, color: colors.text },

  empty: { paddingHorizontal: space.cosy },
  emptyText: { ...type.caption, color: colors.subtle },
});
