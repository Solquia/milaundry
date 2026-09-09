/**
 * One order in the list, built for scanning at arm's length.
 *
 * Two bands: who and how much on top, where it is underneath. The peso figure
 * is the largest thing on the card because it is what the owner scans the
 * right-hand column for, and it goes amber only while the shop is still owed
 * it. "Estimate" is a chip beside the state badges rather than an eleven-point
 * footnote, because it changes what the amber number means. The whole card is
 * read out to a screen reader — badge, tags and time included — from the same
 * domain function the pixels come from.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OrderWithDetails } from '@/lib/api';
import { orderCardLabel } from '@/lib/domain/order-board';
import { formatOrderTime, shortOrderId } from '@/lib/domain/order-card';
import { orderContact } from '@/lib/domain/order-contact';
import { orderTags } from '@/lib/domain/order-tags';

import { CROWN, StatusBadge, Tag, colors, elevation, formatMoney, space, type } from './ui-kit';

export function OrderCard({
  order,
  now,
  onPress,
}: {
  order: OrderWithDetails;
  now: Date;
  onPress: () => void;
}) {
  const total = order.final_total ?? order.estimated_total;
  const isEstimate = (order.final_total ?? null) === null;
  const isOwed = order.payment_status !== 'paid' && order.status !== 'cancelled';
  const contact = orderContact(order);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={orderCardLabel(order, now)}
      accessibilityHint="Opens the order"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.headline}>
        <View style={styles.who}>
          <Text style={[styles.name, !contact.isNamed && styles.nameUnnamed]} numberOfLines={1}>
            {contact.name}
          </Text>
          {/* Two lines allowed: at 360dp one line dropped the phone number
              first, and the phone number is how an uncollected order gets
              chased. */}
          <Text style={styles.meta} numberOfLines={2}>
            {shortOrderId(order.id)} · {formatOrderTime(order.created_at, now)}
            {contact.phone ? ` · ${contact.phone}` : ''}
          </Text>
        </View>
        <Text style={[styles.total, isOwed && styles.totalOwed]}>{formatMoney(total)}</Text>
      </View>
      <View style={styles.tags}>
        <StatusBadge status={order.status} />
        {orderTags(order).map((tag) => (
          <Tag key={tag} label={tag} />
        ))}
        {isEstimate && order.status !== 'cancelled' ? <Tag label="Estimate" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.cosy,
    padding: space.room,
    ...CROWN,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.rest,
  },
  pressed: { opacity: 0.85 },
  headline: { flexDirection: 'row', alignItems: 'flex-start', gap: space.cosy },
  // minWidth 0 lets a long name shrink instead of shoving the total off the card.
  who: { flex: 1, minWidth: 0, gap: 3 },
  name: { ...type.body, fontWeight: '600', color: colors.text },
  nameUnnamed: { fontStyle: 'italic', color: colors.subtle },
  meta: { ...type.caption, color: colors.subtle },
  total: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, color: colors.text },
  totalOwed: { color: colors.moneyOut },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.tight },
});
