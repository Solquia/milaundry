/**
 * Money owed, as a to-do list rather than a figure: Shopee's "To ship / To
 * collect" strip for a laundry. Each lane says whether there is anything to do
 * — ready laundry opens the orders it belongs to, overdue laundry offers a
 * nudge — and the lane still in the machines stays grey, because paying at
 * pickup is normal and nothing there needs chasing.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CollectLane, CollectOrder, CollectSplit } from '@/lib/domain/collect-queue';
import { OVERDUE_AFTER_DAYS } from '@/lib/domain/collect-queue';
import { formatMoneyCompact } from '@/lib/domain/money';

import { RADII, TAG_TONES, colors, elevation, space, type } from './ui-kit';

function Lane({
  dot,
  title,
  hint,
  lane,
  action,
  onPress,
}: {
  dot: string;
  title: string;
  hint: string;
  lane: CollectLane<CollectOrder>;
  action?: string;
  onPress?: () => void;
}) {
  const isEmpty = lane.count === 0;
  const body = (
    <>
      <View style={[styles.dot, { backgroundColor: isEmpty ? colors.border : dot }]} />
      <View style={styles.words}>
        <Text style={[styles.title, isEmpty && styles.muted]}>{title}</Text>
        <Text style={styles.hint}>{isEmpty ? 'None right now' : hint}</Text>
      </View>
      <View style={styles.figures}>
        <Text style={[styles.amount, isEmpty && styles.muted]}>{formatMoneyCompact(lane.amount)}</Text>
        <Text style={styles.hint}>{`${lane.count} order${lane.count === 1 ? '' : 's'}`}</Text>
      </View>
      {action && !isEmpty ? (
        <View style={styles.action}>
          <Text style={styles.actionText}>{action}</Text>
        </View>
      ) : onPress && !isEmpty ? (
        <Ionicons name="chevron-forward" size={16} color={colors.subtle} />
      ) : (
        <View style={styles.chevronSpace} />
      )}
    </>
  );
  if (!onPress || isEmpty) {
    return (
      <View style={styles.lane} accessible accessibilityLabel={`${title}: ${lane.count} orders, ${formatMoneyCompact(lane.amount)}`}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${lane.count} orders, ${formatMoneyCompact(lane.amount)}. ${action ?? 'Open'}.`}
      style={({ pressed }) => [styles.lane, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

export function CollectLanes({
  split,
  onOpenReady,
  onNudge,
}: {
  split: CollectSplit<CollectOrder>;
  onOpenReady: () => void;
  onNudge: () => void;
}) {
  const owed = split.ready.count + split.overdue.count + split.washing.count;
  if (owed === 0) {
    return (
      <View style={[styles.card, styles.clear]}>
        <Ionicons name="checkmark-circle" size={22} color={colors.moneyIn} />
        <Text style={styles.clearText}>Nobody owes you anything. Clean slate!</Text>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <Lane
        dot={colors.moneyIn}
        title="Ready & unpaid"
        hint="Collect at pickup"
        lane={split.ready}
        onPress={onOpenReady}
      />
      <View style={styles.rule} />
      <Lane
        dot={TAG_TONES.owed.ink}
        title={`Unpaid ${OVERDUE_AFTER_DAYS}+ days`}
        hint="Send a friendly reminder"
        lane={split.overdue}
        action="Nudge"
        onPress={onNudge}
      />
      <View style={styles.rule} />
      <Lane dot={colors.borderStrong} title="Still in the machines" hint="Pays at pickup — nothing to chase" lane={split.washing} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADII.card, backgroundColor: colors.card, paddingHorizontal: space.room, ...elevation.rest },
  lane: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, paddingVertical: space.cosy, minHeight: 56 },
  pressed: { opacity: 0.65 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  words: { flex: 1, gap: 1 },
  title: { ...type.label, color: colors.text },
  muted: { color: colors.subtle },
  hint: { ...type.caption, fontSize: 12, color: colors.subtle },
  figures: { alignItems: 'flex-end', gap: 1 },
  amount: { ...type.label, fontSize: 15, color: colors.text },
  action: {
    paddingHorizontal: space.cosy,
    paddingVertical: 6,
    borderRadius: RADII.pill,
    backgroundColor: TAG_TONES.owed.bg,
  },
  actionText: { ...type.caption, fontWeight: '700', color: TAG_TONES.owed.ink },
  chevronSpace: { width: 16 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  clear: { flexDirection: 'row', alignItems: 'center', gap: space.snug, paddingVertical: space.room },
  clearText: { ...type.body, color: colors.text, flex: 1 },
});