/**
 * Choosing when: a month you can see, and the time stated above it.
 *
 * The schedule step used to be two rows of chips — four days and six hours —
 * and the four days were four because 2×2 is a tidy grid, not because a laundry
 * only takes bookings until Thursday. A customer wanting collection a week out
 * had no way to say so, and nothing on screen admitted why.
 *
 * The strip along the top is the answer, stated: the date on the left, the time
 * on the right, each a door back into the control that sets it. Below it the
 * month, with the days the shop will not take drawn and greyed rather than
 * hidden — the shape of the window is a fact the customer should be able to
 * see, not infer from an absence.
 *
 * Which days those are is `calendar-month.ts`. This file draws squares.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  BOOKING_WINDOW_DAYS,
  dayLabel,
  hourLabel,
  type Slot,
} from '@/lib/domain/booking-slot';
import {
  WEEKDAY_INITIALS,
  dayOffsetOf,
  hasSelectableDay,
  monthGrid,
  monthLabel,
  monthOf,
  shiftMonth,
  type MonthCursor,
} from '@/lib/domain/calendar-month';
import { RADII } from '@/lib/domain/design-scale';

import { colors, space, type } from './ui-kit';

/** The hours a rider calls. Two-hourly from eight to six, so six fill a row. */
export const SLOT_HOURS = [8, 10, 12, 14, 16, 18];

/** The accent a calendar borrows. A storefront passes its own shop's. */
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
  /** "Pickup" or "Delivered back" — the strip labels both halves with it. */
  label: string;
  value: Slot;
  onChange: (next: Slot) => void;
  /** Earliest day offered. 0 for pickup; the pickup's own day for delivery. */
  minOffset?: number;
  maxOffset?: number;
  now?: Date;
  tone?: SlotTone;
}

export function SlotCalendar({
  label,
  value,
  onChange,
  minOffset = 0,
  maxOffset = BOOKING_WINDOW_DAYS,
  now = new Date(),
  tone = SLOT_TONE,
}: SlotCalendarProps) {
  // Opens on the month holding the answer, not on today's, so a booking
  // already set for next month does not have to be paged to.
  const [cursor, setCursor] = useState<MonthCursor>(() => monthOf(value.dayOffset, now));
  const [isPickingTime, setPickingTime] = useState(false);

  const weeks = monthGrid(cursor, now, minOffset, maxOffset);
  const step = (delta: number) => setCursor((at) => shiftMonth(at, delta));
  const canStep = (delta: number) =>
    hasSelectableDay(shiftMonth(cursor, delta), now, minOffset, maxOffset);

  return (
    <View style={styles.frame}>
      {/* The answer, stated. Two halves, each a door back to its own control. */}
      <View style={styles.strip}>
        <View style={styles.stripHalf}>
          <Text style={styles.stripLabel}>{label} date</Text>
          <View style={styles.stripValue}>
            <Ionicons name="calendar-outline" size={16} color={colors.subtle} />
            <View style={[styles.datePill, { backgroundColor: tone.accentSoft }]}>
              <Text style={[styles.dateText, { color: tone.accent }]} numberOfLines={1}>
                {dayLabel(value.dayOffset, now)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.stripSeam} />

        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isPickingTime }}
          accessibilityLabel={`${label} time, ${hourLabel(value.hour)}`}
          accessibilityHint={isPickingTime ? 'Closes the times' : 'Opens the times'}
          onPress={() => setPickingTime((open) => !open)}
          style={({ pressed }) => [styles.stripHalf, pressed && styles.pressed]}
        >
          <Text style={styles.stripLabel}>{label} time</Text>
          <View style={styles.stripValue}>
            <Ionicons name="time-outline" size={16} color={colors.subtle} />
            <Text style={styles.timeText}>{hourLabel(value.hour)}</Text>
            <Ionicons
              name={isPickingTime ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={colors.subtle}
            />
          </View>
        </Pressable>
      </View>

      {isPickingTime && (
        <View style={styles.hours}>
          {SLOT_HOURS.map((hour) => {
            const isOn = hour === value.hour;
            return (
              <Pressable
                key={hour}
                accessibilityRole="button"
                accessibilityState={{ selected: isOn }}
                onPress={() => {
                  onChange({ ...value, hour });
                  setPickingTime(false);
                }}
                style={[
                  styles.hour,
                  isOn && { backgroundColor: tone.accent, borderColor: tone.accent },
                ]}
              >
                <Text style={[styles.hourText, isOn && { color: tone.onAccent }]}>
                  {hourLabel(hour)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* An arrow onto a month of dead days is hidden, not disabled: an arrow
          that pages to nothing has lied about there being more. */}
      <View style={styles.monthBar}>
        <Arrow direction="back" show={canStep(-1)} onPress={() => step(-1)} />
        <Text style={styles.monthLabel}>{monthLabel(cursor, now)}</Text>
        <Arrow direction="forward" show={canStep(1)} onPress={() => step(1)} />
      </View>

      <View style={styles.weekdays}>
        {WEEKDAY_INITIALS.map((initial) => (
          <Text key={initial} style={styles.weekday}>
            {initial}
          </Text>
        ))}
      </View>

      {weeks.map((week, index) => (
        <View key={index} style={styles.week}>
          {week.map((square, column) => {
            if (square.kind === 'pad') return <View key={column} style={styles.cell} />;

            const isOn = square.dayOffset === value.dayOffset;
            return (
              <Pressable
                key={column}
                accessibilityRole="button"
                accessibilityState={{ selected: isOn, disabled: !square.isSelectable }}
                accessibilityLabel={dayLabel(square.dayOffset, now)}
                disabled={!square.isSelectable}
                onPress={() =>
                  onChange({
                    ...value,
                    dayOffset: dayOffsetOf(cursor, square.dayOfMonth, now),
                  })
                }
                style={styles.cell}
              >
                <View
                  style={[
                    styles.day,
                    isOn && { backgroundColor: tone.accent },
                    // Today, unchosen, is ringed rather than filled, so it is
                    // never mistaken for the day actually picked.
                    square.isToday && !isOn && { borderColor: tone.accent },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      !square.isSelectable && styles.dayTextOff,
                      isOn && { color: tone.onAccent },
                    ]}
                  >
                    {square.dayOfMonth}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** A month arrow, or the space one would occupy so the label stays centred. */
function Arrow({
  direction,
  show,
  onPress,
}: {
  direction: 'back' | 'forward';
  show: boolean;
  onPress: () => void;
}) {
  if (!show) return <View style={styles.arrow} />;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'back' ? 'Previous month' : 'Next month'}
      onPress={onPress}
      style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
    >
      <Ionicons
        name={direction === 'back' ? 'chevron-back' : 'chevron-forward'}
        size={20}
        color={colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADII.control,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.6 },

  /** The settled answer, ruled off from the calendar that changes it. */
  strip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.sunken,
  },
  stripHalf: { flex: 1, gap: space.tight, padding: space.cosy },
  stripSeam: { width: 1, backgroundColor: colors.border },
  stripLabel: { ...type.caption, color: colors.subtle },
  stripValue: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  datePill: {
    flexShrink: 1,
    borderRadius: RADII.pill,
    paddingHorizontal: space.snug,
    paddingVertical: 3,
  },
  dateText: { ...type.label },
  timeText: { ...type.label, color: colors.text },

  /** Six hours across two rows of three, so none strands alone on a line. */
  hours: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.snug,
    padding: space.cosy,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hour: {
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 40,
    borderRadius: RADII.chip,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  hourText: { ...type.label, color: colors.text },

  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.snug,
    paddingTop: space.snug,
  },
  monthLabel: { ...type.section, color: colors.text },
  /** 44 square: the arrows are the smallest targets on the screen. */
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  weekdays: { flexDirection: 'row', paddingHorizontal: space.snug },
  weekday: {
    ...type.caption,
    flex: 1,
    textAlign: 'center',
    color: colors.subtle,
    paddingVertical: space.snug,
  },

  week: { flexDirection: 'row', paddingHorizontal: space.snug },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  day: {
    width: 38,
    height: 38,
    borderRadius: RADII.pill,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: { ...type.label, color: colors.text },
  /** Outside the window: drawn, so the limit is visible, but plainly not a door. */
  dayTextOff: { color: colors.borderStrong },
});
