/**
 * Chasing what is owed without the awkward call: one tap opens a text with
 * the amount and the shop's GCash already written, or the share sheet for
 * Messenger and Viber. Oldest first, because they have waited longest.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Linking, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { nudgeMessage, smsLink, type CollectOrder, type NudgeShop } from '@/lib/domain/collect-queue';
import { formatMoney } from '@/lib/domain/money';
import { orderContact } from '@/lib/domain/order-contact';

import { SalesSheet } from './sales-sheet';
import { RADII, TAG_TONES, colors, space, type } from './ui-kit';

const DAY = 86_400_000;

function waited(order: CollectOrder, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(order.updated_at).getTime()) / DAY);
  if (days <= 0) return 'today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

function Chip({
  icon,
  label,
  onPress,
  isPrimary,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  isPrimary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.chip, isPrimary && styles.chipPrimary, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon as never} size={14} color={isPrimary ? colors.onAccent : colors.actionInk} />
      <Text style={[styles.chipText, isPrimary && styles.chipTextPrimary]}>{label}</Text>
    </Pressable>
  );
}

export function NudgeSheet({
  visible,
  orders,
  shop,
  now,
  onError,
  onClose,
}: {
  visible: boolean;
  orders: readonly CollectOrder[];
  shop: NudgeShop;
  now: Date;
  onError: (message: string) => void;
  onClose: () => void;
}) {
  const text = (order: CollectOrder, phone: string) => {
    Linking.openURL(smsLink(phone, nudgeMessage(order, shop), Platform.OS)).catch(() =>
      onError('Could not open messages on this device. Try Share instead.')
    );
  };
  const share = (order: CollectOrder) => {
    Share.share({ message: nudgeMessage(order, shop) }).catch(() => onError('Could not open the share sheet.'));
  };

  return (
    <SalesSheet
      visible={visible}
      title="Send a friendly reminder"
      subtitle="The amount and how to pay are written for you"
      onClose={onClose}
    >
      {orders.length === 0 ? (
        <Text style={styles.empty}>Nobody to remind right now.</Text>
      ) : (
        orders.map((order) => {
          const contact = orderContact(order);
          return (
            <View key={order.id} style={styles.row}>
              <View style={styles.words}>
                <Text style={styles.name} numberOfLines={1}>
                  {contact.name}
                </Text>
                <Text style={styles.meta}>
                  {order.status === 'ready' ? 'Ready' : 'Picked up'} · waiting {waited(order, now)}
                </Text>
              </View>
              <Text style={styles.amount}>{formatMoney(order.final_total ?? order.estimated_total)}</Text>
              <View style={styles.actions}>
                {contact.phone ? (
                  <Chip icon="chatbubble-ellipses" label="Text" isPrimary onPress={() => text(order, contact.phone!)} />
                ) : null}
                <Chip icon="share-outline" label="Share" onPress={() => share(order)} />
              </View>
            </View>
          );
        })
      )}
    </SalesSheet>
  );
}

const styles = StyleSheet.create({
  empty: { ...type.body, color: colors.subtle },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.snug,
    padding: space.cosy,
    borderRadius: RADII.control,
    backgroundColor: TAG_TONES.owed.bg,
  },
  words: { flex: 1, minWidth: 140, gap: 1 },
  name: { ...type.label, color: colors.text },
  meta: { ...type.caption, color: TAG_TONES.owed.ink },
  amount: { ...type.label, fontSize: 15, color: colors.text },
  actions: { flexDirection: 'row', gap: space.snug, width: '100%', justifyContent: 'flex-end' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.cosy,
    minHeight: 36,
    borderRadius: RADII.pill,
    backgroundColor: colors.card,
  },
  chipPrimary: { backgroundColor: colors.action },
  chipText: { ...type.caption, fontWeight: '700', color: colors.actionInk },
  chipTextPrimary: { color: colors.onAccent },
});