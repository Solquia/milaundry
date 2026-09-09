/**
 * Where this order is, and when it got there.
 *
 * The old tracker was a column of ✓ ● ○ glyphs against state names. It said
 * which stage was current and nothing else — not when the laundry went into
 * the machine, not how far along the cycle was. Here the cycle is a rail whose
 * live segment is drawn wider (the customer app's device), and each stage the
 * order has passed carries the time it was passed, read off the status
 * history the backend already keeps.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { STATUS_LABELS, type OrderStatus } from '@/lib/domain/order-status';
import { WASH_CYCLE_STAGES, cycleStanding } from '@/lib/domain/wash-cycle';
import type { StatusHistoryRow } from '@/lib/types';

import { RADII, colors, formatWhen, space, type } from './ui-kit';

const STAGES = [
  ...WASH_CYCLE_STAGES,
  { status: 'completed' as const, label: 'Done', icon: 'checkmark-circle-outline' },
];

type StageState = 'done' | 'current' | 'upcoming';

function reachedAt(history: readonly StatusHistoryRow[], status: OrderStatus): string | null {
  const entries = history.filter((row) => row.to_status === status);
  return entries.length > 0 ? entries[entries.length - 1].created_at : null;
}

/** "Since Today, 2:10 PM" for the live stage; the plain time for passed ones. */
function timeTextFor(state: StageState, when: string | null, now: Date): string {
  if (state === 'upcoming') return '';
  if (state === 'current') return when ? `Since ${formatWhen(when, now)}` : 'Now';
  return when ? formatWhen(when, now) : '';
}

export function OrderTimeline({
  status,
  history,
  now,
}: {
  status: OrderStatus;
  history: readonly StatusHistoryRow[];
  now: Date;
}) {
  if (status === 'cancelled') {
    const when = reachedAt(history, 'cancelled');
    return (
      <View style={styles.card}>
        <Text style={styles.heading}>This order was cancelled</Text>
        {when ? <Text style={styles.caption}>{formatWhen(when, now)}</Text> : null}
      </View>
    );
  }

  const currentIndex = STAGES.findIndex((stage) => stage.status === status);
  const stateOf = (index: number): StageState =>
    index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
  const standing = cycleStanding(status);
  const isDone = status === 'completed';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.heading}>Where this order is</Text>
        <Text style={styles.caption}>{standing.caption}</Text>
      </View>

      <View style={styles.rail} accessible={false}>
        {WASH_CYCLE_STAGES.map((stage, index) => {
          const state = isDone ? 'done' : stateOf(index);
          return (
            <View
              key={stage.status}
              style={[
                styles.segment,
                { flex: state === 'current' ? 2.2 : 1 },
                state === 'done' && styles.segmentDone,
                state === 'current' && styles.segmentCurrent,
              ]}
            />
          );
        })}
      </View>

      <View style={styles.rows}>
        {STAGES.map((stage, index) => {
          const state = isDone ? 'done' : stateOf(index);
          const when = state === 'upcoming' ? null : reachedAt(history, stage.status);
          const timeText = timeTextFor(state, when, now);
          return (
            <View
              key={stage.status}
              style={styles.row}
              accessible
              accessibilityLabel={`${STATUS_LABELS[stage.status]}, ${
                state === 'current' ? 'current step' : state === 'done' ? 'done' : 'not yet'
              }${timeText ? `, ${timeText}` : ''}`}
            >
              <View
                style={[
                  styles.mark,
                  state === 'done' && styles.markDone,
                  state === 'current' && styles.markCurrent,
                ]}
              >
                {state === 'done' ? (
                  <Ionicons name="checkmark" size={13} color={colors.onAccent} />
                ) : state === 'current' ? (
                  <Ionicons name={stage.icon as never} size={12} color={colors.onAccent} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.label,
                  state === 'upcoming' && styles.labelUpcoming,
                  state === 'current' && styles.labelCurrent,
                ]}
              >
                {STATUS_LABELS[stage.status]}
              </Text>
              {timeText ? <Text style={styles.time}>{timeText}</Text> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.cosy,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.snug },
  heading: { ...type.section, fontSize: 16, color: colors.text },
  caption: { ...type.caption, color: colors.subtle },
  rail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  segment: { height: 6, borderRadius: 3, backgroundColor: colors.border },
  segmentDone: { backgroundColor: colors.success },
  segmentCurrent: { backgroundColor: colors.action },
  rows: { gap: space.snug, marginTop: space.tight },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, minHeight: 28 },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markDone: { backgroundColor: colors.success, borderColor: colors.success },
  markCurrent: { backgroundColor: colors.action, borderColor: colors.action },
  label: { ...type.body, color: colors.text, flex: 1 },
  labelUpcoming: { color: colors.subtle },
  labelCurrent: { fontWeight: '700' },
  time: { ...type.caption, color: colors.subtle },
});
