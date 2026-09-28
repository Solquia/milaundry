/**
 * Choosing a day and a window: a week you can see whole, then the windows
 * that day has, grouped the way people plan a day.
 *
 * The rail this replaces scrolled sideways with its scrollbar hidden. On a
 * phone that was a swipe nobody was told about; on the shop's web page, with
 * a mouse, it was a wall — "Tu" and "4 PM" cut off at the edge, 6 PM
 * unreachable without shift-scroll. So:
 *
 *   - The week is seven equal columns that always fit. Arrows page it, and a
 *     swipe does too, so it works under a thumb and under a mouse.
 *   - Every day says what it has left before you tap it: dots for how open it
 *     is, or the word for why it is not — Closed, Done, Washing. Nothing is
 *     discovered by tapping.
 *   - Windows wrap in a grid under Morning, Afternoon and Evening. All six are
 *     on screen at once; there is no second rail to scroll.
 *   - A window that cannot be picked stays in its place, struck through, with
 *     the reason under it, so the grid never changes shape between days.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/components/ui-kit';
import { RADII } from '@/lib/domain/design-scale';
import {
  STRIP_LENGTH,
  addDays,
  daysBetween,
  stripDays,
  stripRange,
  windowPart,
  type DayKey,
  type DayPart,
  type DayStatus,
  type ShutReason,
  type Slot,
  type StripDay,
  type WindowState,
} from '@/lib/domain/rider-calendar';
import { useReducedMotion } from '@/lib/use-reduced-motion';

/** A swipe has to travel this far sideways before it turns the page. */
const SWIPE_PX = 40;

const PARTS: readonly { part: DayPart; label: string; icon: string }[] = [
  { part: 'morning', label: 'Morning', icon: 'sunny-outline' },
  { part: 'afternoon', label: 'Afternoon', icon: 'partly-sunny-outline' },
  { part: 'evening', label: 'Evening', icon: 'moon-outline' },
];

/** The word under a day that has nothing to offer. */
const DAY_STATUS_WORD: Record<Exclude<DayStatus, 'open'>, string> = {
  closed: 'Closed',
  done: 'Done',
  washing: 'Washing',
  outside: '—',
};

/** The word under a window that cannot be picked. */
const SHUT_WORD: Record<ShutReason, string> = {
  passed: 'Passed',
  closed: 'Closed',
  washing: 'Still washing',
  outside: 'Too far out',
};

export interface SlotPickerProps {
  /** "Pickup" or "Return", for screen readers. */
  label: string;
  value: Slot;
  onChange: (next: Slot) => void;
  /** The first day the strip shows: today for a pickup, the pickup's own day for a return. */
  rangeStart: DayKey;
  /** The last day that could have anything on offer. */
  rangeEnd: DayKey;
  today: DayKey;
  windowsFor: (day: DayKey) => readonly WindowState[];
  /** The soonest slot on offer anywhere, tagged where it appears. */
  soonest?: Slot | null;
  /** A line under the week — the booking cutoff, say. */
  note?: string | null;
}

function pageOf(rangeStart: DayKey, day: DayKey): number {
  return Math.max(0, Math.floor(daysBetween(rangeStart, day) / STRIP_LENGTH));
}

/** A new day keeps the chosen window when it can, else the nearest one after, else the first. */
function slotOnDay(day: DayKey, hour: number, windows: readonly WindowState[]): Slot | null {
  const open = windows.filter((w) => w.isOpen).map((w) => w.hour);
  if (open.length === 0) return null;
  const keep = open.includes(hour) ? hour : open.find((h) => h > hour) ?? open[open.length - 1];
  return { day, hour: keep };
}

export function SlotPicker({
  label,
  value,
  onChange,
  rangeStart,
  rangeEnd,
  today,
  windowsFor,
  soonest,
  note,
}: SlotPickerProps) {
  const lastPage = pageOf(rangeStart, rangeEnd);
  const valuePage = Math.min(pageOf(rangeStart, value.day), lastPage);
  // The week being browsed, remembered against the pick it was browsed from.
  // When something else moves the pick — the pickup nudging the return onto
  // next week — the strip follows it instead of showing a week without it.
  const follows = `${rangeStart}|${value.day}`;
  const [browse, setBrowse] = useState({ follows, page: valuePage });
  const page = browse.follows === follows ? browse.page : valuePage;
  const turnPage = (delta: number) =>
    setBrowse({ follows, page: Math.min(lastPage, Math.max(0, page + delta)) });

  const start = addDays(rangeStart, page * STRIP_LENGTH);
  const days = useMemo(() => stripDays(start, today, windowsFor), [start, today, windowsFor]);
  const windows = windowsFor(value.day);

  const pick = (day: StripDay) => {
    const next = slotOnDay(day.day, value.hour, windowsFor(day.day));
    if (next) onChange(next);
  };

  return (
    <View style={styles.picker}>
      <WeekStrip
        label={label}
        days={days}
        selected={value.day}
        range={stripRange(start)}
        canGoBack={page > 0}
        canGoOn={page < lastPage}
        onPage={turnPage}
        onPick={pick}
      />
      {note ? (
        <View style={styles.note}>
          <Ionicons name="time-outline" size={14} color={colors.subtle} />
          <Text style={styles.noteText}>{note}</Text>
        </View>
      ) : null}
      <WindowGrid
        label={label}
        windows={windows}
        selected={value.hour}
        soonestHour={soonest && soonest.day === value.day ? soonest.hour : null}
        onPick={(hour) => onChange({ day: value.day, hour })}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// The week.
// ---------------------------------------------------------------------------

function WeekStrip({
  label,
  days,
  selected,
  range,
  canGoBack,
  canGoOn,
  onPage,
  onPick,
}: {
  label: string;
  days: readonly StripDay[];
  selected: DayKey;
  range: string;
  canGoBack: boolean;
  canGoOn: boolean;
  onPage: (delta: number) => void;
  onPick: (day: StripDay) => void;
}) {
  const isReduced = useReducedMotion();
  const [fade] = useState(() => new Animated.Value(1));
  const firstDay = days[0]?.day;
  const hasMounted = useRef(false);

  // A page turn eases in, so the week reads as moving rather than as the
  // numbers blinking to other numbers.
  useEffect(() => {
    if (!hasMounted.current || isReduced) {
      hasMounted.current = true;
      return;
    }
    fade.setValue(0.35);
    Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [firstDay, fade, isReduced]);

  const swipe = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderRelease: (_, g) => {
          if (g.dx <= -SWIPE_PX) onPage(1);
          else if (g.dx >= SWIPE_PX) onPage(-1);
        },
      }),
    [onPage]
  );

  return (
    <View style={styles.week}>
      <View style={styles.pager}>
        <PageArrow direction="back" isEnabled={canGoBack} onPress={() => onPage(-1)} />
        <Text style={styles.pagerText} accessibilityRole="header">
          {range}
        </Text>
        <PageArrow direction="on" isEnabled={canGoOn} onPress={() => onPage(1)} />
      </View>

      <Animated.View style={[styles.days, { opacity: fade }]} {...swipe.panHandlers}>
        {days.map((day) => (
          <DayCell
            key={day.day}
            label={label}
            day={day}
            isOn={day.day === selected}
            onPress={() => onPick(day)}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function PageArrow({
  direction,
  isEnabled,
  onPress,
}: {
  direction: 'back' | 'on';
  isEnabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'back' ? 'Earlier week' : 'Later week'}
      accessibilityState={{ disabled: !isEnabled }}
      disabled={!isEnabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.arrow,
        !isEnabled && styles.arrowOff,
        pressed && styles.arrowPressed,
      ]}
    >
      <Ionicons
        name={direction === 'back' ? 'chevron-back' : 'chevron-forward'}
        size={18}
        color={colors.actionInk}
      />
    </Pressable>
  );
}

/** How open a day is, as one to three dots — a glance, not a count to read. */
function dotsFor(openCount: number): number {
  if (openCount >= 5) return 3;
  if (openCount >= 3) return 2;
  return 1;
}

function DayCell({
  label,
  day,
  isOn,
  onPress,
}: {
  label: string;
  day: StripDay;
  isOn: boolean;
  onPress: () => void;
}) {
  const isOpen = day.status === 'open';
  const spoken = isOpen
    ? `${day.openCount} time${day.openCount === 1 ? '' : 's'} open`
    : DAY_STATUS_WORD[day.status as Exclude<DayStatus, 'open'>];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${day.isToday ? 'today' : day.lead} ${day.dayOfMonth}${
        day.month ? ` ${day.month}` : ''
      }, ${spoken}`}
      accessibilityState={{ selected: isOn, disabled: !isOpen }}
      disabled={!isOpen}
      onPress={onPress}
      style={({ pressed }) => [
        styles.day,
        isOn && styles.dayOn,
        !isOpen && styles.dayOff,
        pressed && isOpen && !isOn && styles.dayPressed,
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.dayLead, day.isToday && styles.dayLeadToday, isOn && styles.inkOnAccent]}
      >
        {day.lead}
      </Text>
      <Text style={[styles.dayNumber, !isOpen && styles.dayNumberOff, isOn && styles.inkOnAccent]}>
        {day.dayOfMonth}
      </Text>
      {isOpen ? (
        <View style={styles.dots}>
          {Array.from({ length: dotsFor(day.openCount) }, (_, i) => (
            <View key={i} style={[styles.dot, isOn && styles.dotOn]} />
          ))}
        </View>
      ) : (
        <Text numberOfLines={1} style={styles.dayWord}>
          {DAY_STATUS_WORD[day.status as Exclude<DayStatus, 'open'>]}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// The windows.
// ---------------------------------------------------------------------------

function WindowGrid({
  label,
  windows,
  selected,
  soonestHour,
  onPick,
}: {
  label: string;
  windows: readonly WindowState[];
  selected: number;
  soonestHour: number | null;
  onPick: (hour: number) => void;
}) {
  if (windows.length > 0 && windows.every((w) => w.reason === 'closed')) {
    return (
      <View style={styles.dayShut}>
        <Ionicons name="moon-outline" size={18} color={colors.subtle} />
        <Text style={styles.dayShutText}>No riders out this day. Pick another day above.</Text>
      </View>
    );
  }

  return (
    <View style={styles.parts}>
      {PARTS.map(({ part, label: partLabel, icon }) => {
        const inPart = windows.filter((w) => windowPart(w.hour) === part);
        if (inPart.length === 0) return null;
        return (
          <View key={part} style={styles.part}>
            <View style={styles.partHead}>
              <Ionicons name={icon as never} size={14} color={colors.subtle} />
              <Text style={styles.partLabel}>{partLabel}</Text>
            </View>
            <View style={styles.windowRow}>
              {inPart.map((w) => (
                <WindowChip
                  key={w.hour}
                  label={label}
                  window={w}
                  isOn={w.hour === selected}
                  isSoonest={w.hour === soonestHour && w.isOpen}
                  onPress={() => onPick(w.hour)}
                />
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function WindowChip({
  label,
  window,
  isOn,
  isSoonest,
  onPress,
}: {
  label: string;
  window: WindowState;
  isOn: boolean;
  isSoonest: boolean;
  onPress: () => void;
}) {
  const shut = window.reason ? SHUT_WORD[window.reason] : null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} ${window.label}${shut ? `, ${shut.toLowerCase()}` : ''}${
        isSoonest ? ', soonest' : ''
      }`}
      accessibilityState={{ selected: isOn, disabled: !window.isOpen }}
      disabled={!window.isOpen}
      onPress={onPress}
      style={({ pressed }) => [
        styles.window,
        isOn && styles.windowOn,
        !window.isOpen && styles.windowOff,
        pressed && window.isOpen && !isOn && styles.windowPressed,
      ]}
    >
      <View style={styles.windowLine}>
        {isOn ? <Ionicons name="checkmark-circle" size={16} color={colors.onAccent} /> : null}
        <Text
          numberOfLines={1}
          style={[
            styles.windowText,
            isOn && styles.inkOnAccent,
            !window.isOpen && styles.windowTextOff,
          ]}
        >
          {window.label}
        </Text>
      </View>
      {shut ? (
        <Text style={styles.windowWhy}>{shut}</Text>
      ) : isSoonest ? (
        <Text style={[styles.windowTag, isOn && styles.inkOnAccent]}>Soonest</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  picker: { gap: space.cosy },

  week: { gap: space.snug },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pagerText: { ...type.label, color: colors.text },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  arrowOff: { opacity: 0.35 },
  arrowPressed: { backgroundColor: colors.actionSurface },

  /** Seven equal columns: they always fit, so nothing is ever cut off at the edge. */
  days: { flexDirection: 'row', gap: 4 },
  day: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.snug,
    borderRadius: RADII.chip,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayOn: {
    backgroundColor: colors.action,
    borderColor: colors.action,
    shadowColor: colors.action,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  /** Recessed rather than greyed out: still legible, plainly not a button. */
  dayOff: { backgroundColor: 'transparent', borderColor: 'transparent' },
  dayPressed: { backgroundColor: colors.actionSurface },
  dayLead: { ...type.caption, fontSize: 11, lineHeight: 14, color: colors.subtle },
  /** Today is told by its word, in ink — never by a ring that looks like a selection. */
  dayLeadToday: { color: colors.actionInk, fontFamily: type.label.fontFamily },
  dayNumber: { ...type.section, color: colors.text },
  dayNumberOff: { color: colors.subtle, opacity: 0.55 },
  dots: { flexDirection: 'row', gap: 3, height: 12, alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary },
  dotOn: { backgroundColor: colors.onAccent },
  dayWord: { ...type.caption, fontSize: 10, lineHeight: 12, color: colors.subtle },
  inkOnAccent: { color: colors.onAccent },

  note: { flexDirection: 'row', alignItems: 'center', gap: space.tight },
  noteText: { ...type.caption, color: colors.subtle, flexShrink: 1 },

  parts: { gap: space.cosy },
  part: { gap: space.tight + 2 },
  partHead: { flexDirection: 'row', alignItems: 'center', gap: space.tight },
  partLabel: { ...type.caption, color: colors.subtle },
  windowRow: { flexDirection: 'row', gap: space.snug },
  window: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: space.snug,
    paddingVertical: space.tight + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  windowOn: {
    backgroundColor: colors.action,
    borderColor: colors.action,
    shadowColor: colors.action,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2,
  },
  windowOff: { backgroundColor: colors.sunken, borderStyle: 'dashed' },
  windowPressed: { backgroundColor: colors.actionSurface },
  windowLine: { flexDirection: 'row', alignItems: 'center', gap: space.tight },
  windowText: { ...type.label, color: colors.text },
  windowTextOff: { color: colors.subtle, textDecorationLine: 'line-through' },
  windowWhy: { ...type.caption, fontSize: 11, lineHeight: 14, color: colors.subtle },
  windowTag: {
    ...type.caption,
    fontSize: 11,
    lineHeight: 14,
    color: colors.moneyIn,
    fontFamily: type.label.fontFamily,
  },

  dayShut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    padding: space.cosy,
    borderRadius: RADII.chip,
    backgroundColor: colors.sunken,
  },
  dayShutText: { ...type.caption, color: colors.subtle, flexShrink: 1 },
});
