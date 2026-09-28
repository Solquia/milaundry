/**
 * The schedule, drawn as the journey the laundry takes: a rider collects it,
 * it spends a while in the shop, and it comes back.
 *
 * The step used to ask two separate questions — "Pickup" and "Delivered
 * back" — in two identical rows with arrow icons that read as upload and
 * download, then said the answer a third time underneath ("Next day · Back
 * the day after we collect it"). The wait between them, the one thing that
 * makes the pair make sense, was a footnote.
 *
 * Here the two stops hang off one line, and the wait between them is said
 * once, as a note beside the return. Each stop states its answer once, in
 * the shape a person says it — "Today, 25 Sep" and "2–4 PM" — and opens into
 * the picker when tapped. Problems appear under the stop they
 * belong to *as they happen*, not after Continue: a window that passes while
 * the page sits open says so on its own.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Reveal } from '@/components/reveal';
import { SlotPicker } from '@/components/slot-picker';
import { colors, space, type } from '@/components/ui-kit';
import { RADII } from '@/lib/domain/design-scale';
import {
  addDays,
  bookingCutoff,
  dayTitle,
  pickupWindows,
  reconcileReturn,
  returnWindows,
  shopToday,
  slotProblems,
  suggestSchedule,
  timeText,
  turnaroundText,
  windowLabel,
  type DayKey,
  type ShopHours,
  type Slot,
} from '@/lib/domain/rider-calendar';

export type StopName = 'pickup' | 'deliver';

export interface Schedule {
  pickup: Slot;
  deliver: Slot;
}

export interface SchedulePlannerProps {
  value: Schedule;
  onChange: (next: Schedule) => void;
  /** Which stop is open for editing; one at a time, so the step never becomes a wall. */
  openStop: StopName | null;
  onOpenStop: (stop: StopName | null) => void;
  hours: ShopHours;
  /** Ticking, so windows shut on screen as they pass. */
  now: Date;
}

export function SchedulePlanner({
  value,
  onChange,
  openStop,
  onOpenStop,
  hours,
  now,
}: SchedulePlannerProps) {
  const { pickup, deliver } = value;
  const today = shopToday(now, hours);
  const problems = slotProblems(pickup, deliver, now, hours);

  const pickupWindowsFor = useCallback(
    (day: DayKey) => pickupWindows(day, now, hours),
    [now, hours]
  );
  const returnWindowsFor = useCallback(
    (day: DayKey) => returnWindows(day, pickup, now, hours),
    [pickup, now, hours]
  );

  const soonestPickup = suggestSchedule(now, hours)?.pickup ?? null;
  const soonestReturn = reconcileReturn(
    pickup,
    { day: pickup.day, hour: hours.windowStarts[0] ?? 0 },
    now,
    hours
  );

  const cutoff = bookingCutoff(now, hours);
  const pickupNote = cutoff
    ? `Book by ${cutoff} for a pickup today.`
    : "Today's pickups are done — the earliest is tomorrow.";

  const setPickup = (next: Slot) =>
    // The return follows the pickup only as far as it must: kept if it still
    // works, slid to the first washed window if it does not.
    onChange({ pickup: next, deliver: reconcileReturn(next, deliver, now, hours) });

  const toggle = (stop: StopName) => onOpenStop(openStop === stop ? null : stop);

  return (
    <View style={styles.journey}>
      <Stop
        title="Rider collects"
        icon="bicycle"
        slot={pickup}
        today={today}
        hours={hours}
        hint={`Have it bagged by ${timeText(pickup.hour)} — the rider comes any time in the window.`}
        problem={problems.pickupAt}
        isOpen={openStop === 'pickup'}
        onToggle={() => toggle('pickup')}
        hasTrailingLine
      >
        <SlotPicker
          label="Pickup"
          value={pickup}
          onChange={setPickup}
          rangeStart={today}
          rangeEnd={addDays(today, hours.pickupDays)}
          today={today}
          windowsFor={pickupWindowsFor}
          soonest={soonestPickup}
          note={pickupNote}
        />
      </Stop>

      <Stop
        title="Back to you"
        aside={`${turnaroundText(pickup, deliver).toLowerCase()} later`}
        icon="home"
        slot={deliver}
        today={today}
        hours={hours}
        hint={`Someone needs to be in to receive it, ${windowLabel(deliver.hour, hours)}.`}
        problem={problems.deliverBy}
        isOpen={openStop === 'deliver'}
        onToggle={() => toggle('deliver')}
      >
        <SlotPicker
          label="Return"
          value={deliver}
          onChange={(next) => onChange({ pickup, deliver: next })}
          rangeStart={pickup.day}
          rangeEnd={addDays(pickup.day, hours.returnDays)}
          today={today}
          windowsFor={returnWindowsFor}
          soonest={soonestReturn}
        />
      </Stop>
    </View>
  );
}

// ---------------------------------------------------------------------------
// One stop on the journey.
// ---------------------------------------------------------------------------

function Stop({
  title,
  aside,
  icon,
  slot,
  today,
  hours,
  hint,
  problem,
  isOpen,
  onToggle,
  hasTrailingLine = false,
  children,
}: {
  title: string;
  /** A few words beside the title — how long after the pickup, for the return. */
  aside?: string;
  icon: string;
  slot: Slot;
  today: DayKey;
  hours: ShopHours;
  hint: string;
  problem?: string;
  isOpen: boolean;
  onToggle: () => void;
  /** Draws the line on to the next stop down the rail. */
  hasTrailingLine?: boolean;
  children: React.ReactNode;
}) {
  const window = windowLabel(slot.hour, hours);
  const day = dayTitle(slot.day, today);

  return (
    <View style={styles.stop}>
      {/* The rail: a node, then the line on to whatever comes next. It
          stretches with the stop, so an open picker keeps the thread. */}
      <View style={styles.rail}>
        <View style={[styles.node, problem ? styles.nodeProblem : null]}>
          <Ionicons name={icon as never} size={18} color={colors.onAccent} />
        </View>
        {hasTrailingLine ? <View style={styles.railLine} /> : null}
      </View>

      <View style={styles.stopBody}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={`${title}: ${day}, ${window}${aside ? `, ${aside}` : ''}`}
          accessibilityHint={isOpen ? 'Closes the choices' : 'Opens the day and time choices'}
          onPress={onToggle}
          style={({ pressed }) => [styles.stopHead, pressed && styles.stopHeadPressed]}
        >
          <View style={styles.stopText}>
            <Text style={styles.stopTitle} numberOfLines={1}>
              {title.toUpperCase()}
              {aside ? <Text style={styles.stopAside}>{`  ·  ${aside}`}</Text> : null}
            </Text>
            <Text style={styles.stopDay} numberOfLines={1}>
              {day}
            </Text>
            <View style={styles.windowPill}>
              <Ionicons name="time-outline" size={13} color={colors.actionInk} />
              <Text style={styles.windowPillText}>{window}</Text>
            </View>
          </View>
          <View style={[styles.change, isOpen && styles.changeOpen]}>
            <Text style={[styles.changeText, isOpen && styles.changeTextOpen]}>
              {isOpen ? 'Done' : 'Change'}
            </Text>
            <Ionicons
              name={isOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={isOpen ? colors.onAccent : colors.actionInk}
            />
          </View>
        </Pressable>

        {problem ? (
          <View style={styles.problem} accessibilityRole="alert">
            <Ionicons name="alert-circle" size={16} color={colors.dangerInk} />
            <Text style={styles.problemText}>{problem}</Text>
          </View>
        ) : (
          <Text style={styles.hint}>{hint}</Text>
        )}

        {isOpen ? <Reveal style={styles.panel}>{children}</Reveal> : null}
      </View>
    </View>
  );
}

const NODE = 36;
const RAIL_WIDTH = 2;
/** Soft red field behind a problem, one step off the card so it reads as a note, not a banner. */
const PROBLEM_SURFACE = '#FEF2F2';
const PROBLEM_RING = '#FDE2E2';

const styles = StyleSheet.create({
  journey: { gap: 0 },

  stop: { flexDirection: 'row', gap: space.cosy },
  rail: { width: NODE, alignItems: 'center' },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.action,
    // A ring of soft blue lifts the node off the line it sits on.
    borderWidth: 3,
    borderColor: colors.actionSurface,
  },
  nodeProblem: { backgroundColor: colors.dangerInk, borderColor: PROBLEM_RING },
  railLine: {
    flex: 1,
    width: RAIL_WIDTH,
    minHeight: space.cosy,
    backgroundColor: colors.actionMuted,
  },

  stopBody: { flex: 1, minWidth: 0, gap: space.snug, paddingBottom: space.room },
  stopHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.snug },
  stopHeadPressed: { opacity: 0.7 },
  stopText: { flex: 1, minWidth: 0, gap: 3 },
  stopTitle: { ...type.caption, fontSize: 11, letterSpacing: 1, color: colors.subtle },
  /** Not shouted like the title: it is a note, in the ink of the time pill. */
  stopAside: { letterSpacing: 0.2, color: colors.actionInk },
  stopDay: { ...type.section, color: colors.text },
  windowPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.tight,
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    backgroundColor: colors.actionSurface,
  },
  windowPillText: { ...type.label, color: colors.actionInk },

  /** A real button shape, not a bare chevron: it is how the stop opens. */
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 36,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: colors.actionMuted,
    backgroundColor: colors.card,
  },
  changeOpen: { backgroundColor: colors.action, borderColor: colors.action },
  changeText: { ...type.label, color: colors.actionInk },
  changeTextOpen: { color: colors.onAccent },

  hint: { ...type.caption, color: colors.subtle },
  problem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.tight + 2,
    padding: space.snug,
    borderRadius: RADII.chip,
    backgroundColor: PROBLEM_SURFACE,
  },
  problemText: { ...type.caption, color: colors.dangerInk, flexShrink: 1 },

  panel: {
    marginTop: space.tight,
    padding: space.cosy,
    borderRadius: RADII.control,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
  },

});
