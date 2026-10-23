/**
 * "What to do next" on Sales: the handful of steps `owner-actions` reads off
 * the day's money, stock, supplies and spending. Each one opens the screen
 * where it gets done, so the owner acts on the numbers instead of reading them.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ActionTarget, ActionTone, OwnerAction } from '@/lib/domain/owner-actions';

import { glassPane } from './glass';
import { RADII, TAG_TONES, colors, space, type } from './ui-kit';

const TONE_LOOK: Record<ActionTone, { icon: string; ink: string; bg: string }> = {
  urgent: { icon: 'alert-circle', ink: colors.dangerInk, bg: '#FDE8E7' },
  warn: { icon: 'warning', ink: TAG_TONES.owed.ink, bg: TAG_TONES.owed.bg },
  tip: { icon: 'bulb', ink: colors.actionInk, bg: '#E5F0FF' },
  good: { icon: 'checkmark-circle', ink: TAG_TONES.settled.ink, bg: TAG_TONES.settled.bg },
};

function Step({ action, onOpen }: { action: OwnerAction; onOpen: (target: ActionTarget) => void }) {
  const look = TONE_LOOK[action.tone];
  const target = action.target;
  const body = (
    <>
      <View style={[styles.badge, { backgroundColor: look.bg }]}>
        <Ionicons name={look.icon as never} size={18} color={look.ink} />
      </View>
      <View style={styles.words}>
        <Text style={styles.title}>{action.title}</Text>
        <Text style={styles.detail}>{action.detail}</Text>
      </View>
      {target ? <Ionicons name="chevron-forward" size={16} color={colors.actionInk} /> : null}
    </>
  );
  if (!target) return <View style={styles.step}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${action.title}. ${action.detail}`}
      onPress={() => onOpen(target)}
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

export function NextStepsCard({
  actions,
  onOpen,
}: {
  actions: readonly OwnerAction[];
  onOpen: (target: ActionTarget) => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>What to do next</Text>
      {actions.map((action) => (
        <Step key={action.key} action={action} onOpen={onOpen} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...glassPane, borderRadius: RADII.card, padding: space.room, gap: space.snug },
  heading: { ...type.section, color: colors.text },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, paddingVertical: space.tight },
  pressed: { opacity: 0.7 },
  badge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  words: { flex: 1, minWidth: 0, gap: 1 },
  title: { ...type.body, fontWeight: '600', color: colors.text },
  detail: { ...type.caption, color: colors.subtle },
});
