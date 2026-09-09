/**
 * The account behind an order, and the door to their history.
 *
 * A ticket the counter wrote for "Maria" looks the same before and after Maria
 * scans it into her app — the shop had no way to see that it happened, or
 * that the Maria who scanned it is the same person who has brought eleven
 * loads before. This card names the account in its own words, says how it
 * came to hold the order, and opens the profile that lists every order of
 * theirs. It renders nothing for a walk-in nobody has claimed; the QR card
 * below already handles that case.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { accentIndex } from '@/lib/domain/accent';
import { customerInitials } from '@/lib/domain/customer-insights';
import {
  findHolderAccount,
  holderBookKey,
  holderSummary,
  orderHolder,
  type HeldOrder,
  type HolderAccount,
} from '@/lib/domain/order-holder';

import { ACCENTS, RADII, colors, elevation, space, type } from './ui-kit';

interface OrderHolderCardProps {
  order: HeldOrder;
  /** The shop's customer list; undefined while it is still loading. */
  accounts: readonly HolderAccount[] | undefined;
  now: Date;
  /** Receives the customer-book key (`acct:<id>`) the profile route takes. */
  onOpen: (bookKey: string) => void;
}

export function OrderHolderCard({ order, accounts, now, onOpen }: OrderHolderCardProps) {
  const account = findHolderAccount(order, accounts ?? []);
  const summary = holderSummary(order, account, now);
  const bookKey = holderBookKey(orderHolder(order));
  if (!summary || bookKey === null) return null;

  const accent = ACCENTS[accentIndex(bookKey, ACCENTS.length)];
  const spoken = [summary.name, summary.detail, summary.otherPhone && `also ${summary.otherPhone}`]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint="Opens their profile and past orders"
      onPress={() => onOpen(bookKey)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.avatar, { backgroundColor: accent.surface }]}>
        <Text style={[styles.initials, { color: accent.ink }]}>
          {summary.isNamed ? customerInitials(summary.name) : '?'}
        </Text>
      </View>
      <View style={styles.words}>
        <Text style={[styles.name, !summary.isNamed && styles.nameUnnamed]} numberOfLines={1}>
          {summary.name}
        </Text>
        <Text style={styles.detail} numberOfLines={2}>
          {summary.detail}
        </Text>
        {summary.otherPhone ? (
          <Text style={styles.detail} numberOfLines={1}>
            Account number {summary.otherPhone}
          </Text>
        ) : null}
        <Text style={styles.link}>See profile and past orders</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.rest,
  },
  pressed: { opacity: 0.85 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 14, fontWeight: '700', letterSpacing: 0.3 },
  words: { flex: 1, minWidth: 0, gap: 2 },
  name: { ...type.body, fontWeight: '600', color: colors.text },
  nameUnnamed: { fontStyle: 'italic', fontWeight: '500', color: colors.subtle },
  detail: { ...type.caption, color: colors.subtle },
  link: { ...type.caption, fontWeight: '600', color: colors.primary, marginTop: 2 },
});
