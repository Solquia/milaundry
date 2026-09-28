/**
 * The hand-off between the scale and the customer's phone, as the counter sees it.
 *
 * `WeighModal` lifts the weigh sheet out of the scroll: it is the step the
 * order screen's footer now asks for, so it opens over the order rather than
 * sending the owner hunting for the fifth card. `SentPrice` is the other half —
 * once the price is sent, the owner sees exactly what the customer was shown:
 * the photo of the load on the scale, the reading, and the figure they can now
 * pay online.
 */
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import React from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { orderPhotoUrl, type OrderWithDetails } from '@/lib/api';
import type { SettleStep } from '@/lib/domain/order-settlement';
import { formatKg, weighEvidence } from '@/lib/domain/weigh-evidence';

import { RADII, colors, formatMoney, space, type } from './ui-kit';
import { PriceCheckSheet } from './price-check-sheet';

export function WeighModal({
  order,
  isVisible,
  onClose,
  onWeighed,
}: {
  order: OrderWithDetails;
  isVisible: boolean;
  onClose: () => void;
  onWeighed: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.scrim} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.room) }]}
        >
          <View style={styles.grip} />
          <View style={styles.head}>
            <Text style={styles.lede}>
              Weigh and count what came in, and photograph it. The customer gets the photo and the
              actual price, and can pay online from then on.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={space.snug}
              style={({ pressed }) => [styles.closeKey, pressed && styles.pressed]}
            >
              <Ionicons name="close" size={22} color={colors.subtle} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
            <PriceCheckSheet order={order} onConfirmed={onWeighed} />
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/** What the Payment card says while the money is not the counter's to take yet. */
export function settleLead(step: SettleStep, order: Pick<OrderWithDetails, 'order_type'>): string | null {
  if (order.order_type !== 'online') return null;
  if (step === 'receive') return 'Once the laundry arrives, check it. The customer can pay online after you send the actual price.';
  if (step === 'confirm_price') return 'Confirm the actual price to send it. Online payment opens for the customer after that, and washing once they have paid.';
  return null;
}

/** The photo, the reading and the figure — the customer's view, shown to the shop. */
export function SentPrice({ order }: { order: OrderWithDetails }) {
  const evidence = weighEvidence(order);
  const { data: url } = useQuery({
    queryKey: ['order-photo', evidence?.photoPath],
    queryFn: () => orderPhotoUrl(evidence!.photoPath),
    enabled: Boolean(evidence),
  });

  return (
    <View style={styles.sent}>
      {evidence && url ? (
        <Image
          source={{ uri: url }}
          style={styles.thumb}
          contentFit="cover"
          accessibilityLabel={evidence.caption}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Ionicons name="scale-outline" size={22} color={colors.subtle} />
        </View>
      )}
      <View style={styles.sentText}>
        <View style={styles.sentBadge}>
          <Ionicons name="checkmark-circle" size={14} color={colors.moneyIn} />
          <Text style={styles.sentBadgeText}>Price sent to customer</Text>
        </View>
        <Text style={styles.sentTotal}>{formatMoney(order.final_total ?? order.estimated_total)}</Text>
        <Text style={styles.sentMeta}>
          {order.actual_weight_kg !== null ? `${formatKg(order.actual_weight_kg)} on the scale · ` : ''}
          waiting for them to pay online
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11, 27, 43, 0.45)' },
  scrim: { flex: 1 },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.room,
    paddingTop: space.snug,
    gap: space.cosy,
  },
  grip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: space.tight,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: space.cosy },
  lede: { ...type.body, flex: 1, color: colors.subtle },
  closeKey: {
    width: 36,
    height: 36,
    borderRadius: RADII.card,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  body: { paddingBottom: space.room },
  pressed: { opacity: 0.7 },

  sent: { flexDirection: 'row', gap: space.cosy, alignItems: 'center' },
  thumb: { width: 72, height: 72, borderRadius: 12, backgroundColor: colors.sunken },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  sentText: { flex: 1, gap: 2 },
  sentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sentBadgeText: { ...type.caption, fontWeight: '700', color: colors.moneyIn },
  sentTotal: { ...type.section, color: colors.text },
  sentMeta: { ...type.caption, color: colors.subtle },
});
