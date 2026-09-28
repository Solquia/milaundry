/**
 * The day's goal as a bar that fills, like the partner targets delivery apps
 * set their riders. Unset, it is a one-line invitation; hit, it turns gold.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoneyCompact } from '@/lib/domain/money';
import { goalProgress } from '@/lib/domain/sales-goal';

import { RADII, colors, type } from './ui-kit';

const GOLD = '#B7791F';
const GOLD_FILL = '#F6C453';

export function GoalBar({
  collected,
  goal,
  onEdit,
}: {
  collected: number;
  goal: number | null;
  onEdit: () => void;
}) {
  if (goal === null) {
    return (
      <Pressable
        onPress={onEdit}
        accessibilityRole="button"
        style={({ pressed }) => [styles.invite, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name="flag-outline" size={15} color={colors.actionInk} />
        <Text style={styles.inviteText}>Set a daily goal</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.actionInk} />
      </Pressable>
    );
  }

  const progress = goalProgress(collected, goal);
  const caption = progress.isHit
    ? `Goal hit · ${progress.pct}% of ${formatMoneyCompact(goal)} 🎉`
    : `${progress.pct}% of ${formatMoneyCompact(goal)} goal · ${formatMoneyCompact(progress.remaining)} to go`;

  return (
    <Pressable
      onPress={onEdit}
      accessibilityRole="button"
      accessibilityLabel={`${caption}. Change the goal.`}
      style={({ pressed }) => [styles.wrap, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(progress.ratio * 100)}%` },
            progress.isHit && { backgroundColor: GOLD_FILL },
          ]}
        />
      </View>
      <Text style={[styles.caption, progress.isHit && { color: GOLD, fontWeight: '700' }]}>{caption}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  track: { height: 10, borderRadius: RADII.pill, backgroundColor: 'rgba(11, 122, 69, 0.14)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADII.pill, backgroundColor: colors.moneyIn },
  caption: { ...type.caption, color: colors.subtle },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 2 },
  inviteText: { ...type.caption, fontWeight: '700', color: colors.actionInk },
});