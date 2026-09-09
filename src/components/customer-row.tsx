/**
 * One customer in the book.
 *
 * The initials wear a stable tone hashed from the person's identity, the same
 * device the customer app uses to tell two shops apart, so a regular is
 * findable at a glance the way a contact avatar is. Money owed is the only
 * thing on the row that carries colour.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { accentIndex } from '@/lib/domain/accent';
import { STANDING_LABELS, customerInitials, type CustomerInsight } from '@/lib/domain/customer-insights';
import { formatOrderTime } from '@/lib/domain/order-card';

import { ACCENTS, RADII, TAG_TONES, colors, elevation, formatMoney, space, type } from './ui-kit';

function visits(count: number): string {
  return `${count} ${count === 1 ? 'order' : 'orders'}`;
}

export function CustomerRow({
  customer,
  now,
  onPress,
}: {
  customer: CustomerInsight;
  now: Date;
  onPress: () => void;
}) {
  const accent = ACCENTS[accentIndex(customer.key, ACCENTS.length)];
  const hasOrders = customer.orderCount > 0;
  const line = hasOrders
    ? `${visits(customer.orderCount)} · Last ${formatOrderTime(customer.lastOrderAt!, now)}`
    : STANDING_LABELS.connected;
  const isOwing = customer.owed > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${customer.name}. ${line}. Lifetime value ${formatMoney(
        customer.lifetimeValue
      )}${isOwing ? `, owes ${formatMoney(customer.owed)}` : ''}. ${
        STANDING_LABELS[customer.standing]
      }.`}
      accessibilityHint="Opens their orders"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.avatar, { backgroundColor: accent.surface }]}>
        <Text style={[styles.initials, { color: accent.ink }]}>
          {customerInitials(customer.name)}
        </Text>
      </View>
      <View style={styles.words}>
        <Text style={styles.name} numberOfLines={1}>
          {customer.name}
        </Text>
        <Text style={styles.line} numberOfLines={1}>
          {line}
        </Text>
      </View>
      <View style={styles.figures}>
        <Text style={styles.value}>{formatMoney(customer.lifetimeValue)}</Text>
        {isOwing ? (
          <View style={styles.owedPill}>
            <Text style={styles.owedText}>Owes {formatMoney(customer.owed)}</Text>
          </View>
        ) : (
          <Text style={styles.standing}>{STANDING_LABELS[customer.standing]}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.cosy,
    paddingRight: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.rest,
  },
  pressed: { opacity: 0.85 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  words: { flex: 1, gap: 2, minWidth: 0 },
  name: { ...type.body, fontWeight: '600', color: colors.text },
  line: { ...type.caption, color: colors.subtle },
  figures: { alignItems: 'flex-end', gap: 3 },
  value: { ...type.body, fontWeight: '700', color: colors.text },
  standing: { ...type.caption, color: colors.subtle },
  owedPill: {
    borderRadius: RADII.chip,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: TAG_TONES.owed.bg,
  },
  owedText: { fontSize: 11, fontWeight: '600', color: TAG_TONES.owed.ink },
});
