/**
 * Every order taken in the period on screen, each with its own delete, so
 * the owner can pick out the test runs they made while setting up and leave
 * the real ones. A deleted order leaves the figures behind this sheet too.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { OrderWithDetails } from '@/lib/api';
import { ordersTakenIn } from '@/lib/domain/clear-orders';
import { formatMoney } from '@/lib/domain/money';
import { formatOrderTime, shortOrderId } from '@/lib/domain/order-card';
import { orderContact } from '@/lib/domain/order-contact';
import { useDeleteOrder } from '@/lib/use-delete-order';

import { SalesSheet } from './sales-sheet';
import { ErrorText, colors, space, type } from './ui-kit';

export function ClearOrdersSheet({
  visible,
  orders,
  frame,
  now,
  onClose,
}: {
  visible: boolean;
  orders: readonly OrderWithDetails[];
  frame: { start: number; end: number; title: string };
  now: Date;
  onClose: () => void;
}) {
  const { confirmDelete, deletingId, error } = useDeleteOrder();
  const taken = useMemo(() => ordersTakenIn(orders, frame), [orders, frame]);

  return (
    <SalesSheet
      visible={visible}
      title="Clear test orders"
      subtitle={`${frame.title} · ${taken.length} order${taken.length === 1 ? '' : 's'}. Delete the ones that were only a test.`}
      onClose={onClose}
    >
      {error ? <ErrorText>{error}</ErrorText> : null}
      {taken.length === 0 ? (
        <Text style={styles.empty}>No orders taken in this period.</Text>
      ) : (
        taken.map((order) => {
          const contact = orderContact(order);
          const isDeleting = deletingId === order.id;
          return (
            <View key={order.id} style={styles.row}>
              <View style={styles.words}>
                <Text style={styles.name} numberOfLines={1}>
                  {contact.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {shortOrderId(order.id)} · {formatOrderTime(order.created_at, now)} ·{' '}
                  {formatMoney(order.final_total ?? order.estimated_total)}
                </Text>
              </View>
              <Pressable
                onPress={() => confirmDelete(order)}
                disabled={deletingId !== null}
                accessibilityRole="button"
                accessibilityLabel={`Delete order ${shortOrderId(order.id)} for ${contact.name}`}
                hitSlop={8}
                style={({ pressed }) => [styles.delete, pressed && { opacity: 0.6 }]}
              >
                <Ionicons name="trash-outline" size={16} color={colors.dangerInk} />
                <Text style={styles.deleteText}>{isDeleting ? 'Deleting…' : 'Delete'}</Text>
              </Pressable>
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
    alignItems: 'center',
    gap: space.cosy,
    paddingVertical: space.snug,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60, 60, 67, 0.12)',
  },
  words: { flex: 1, gap: 1 },
  name: { ...type.label, color: colors.text },
  meta: { ...type.caption, color: colors.subtle },
  delete: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.snug },
  deleteText: { ...type.caption, fontWeight: '600', color: colors.dangerInk },
});
