/**
 * Every payment behind the big figure — the "view transactions" a delivery
 * app puts under its sales total. A figure you can open up is a figure you
 * can trust, and a row opens the order it came from.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '@/lib/domain/money';
import { PAYMENT_LABELS } from '@/lib/domain/payment-summary';
import type { SalesPayment } from '@/lib/domain/sales-metrics';
import type { BucketUnit } from '@/lib/domain/sales-period';

import { SalesSheet } from './sales-sheet';
import { RADII, colors, space, type } from './ui-kit';

function when(iso: string, unit: BucketUnit): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (unit === 'hour') return time;
  return `${date.toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${time}`;
}

export function PaymentsSheet({
  visible,
  title,
  payments,
  total,
  unit,
  onOpenOrder,
  onClose,
}: {
  visible: boolean;
  title: string;
  payments: readonly SalesPayment[];
  total: number;
  unit: BucketUnit;
  onOpenOrder: (orderId: string) => void;
  onClose: () => void;
}) {
  return (
    <SalesSheet
      visible={visible}
      title={`${payments.length} payment${payments.length === 1 ? '' : 's'}`}
      subtitle={`${title} · ${formatMoney(total)} in total`}
      onClose={onClose}
    >
      {payments.length === 0 ? (
        <Text style={styles.empty}>No payments in this period yet.</Text>
      ) : (
        payments.map((payment) => (
          <Pressable
            key={payment.id}
            onPress={() => onOpenOrder(payment.id)}
            accessibilityRole="button"
            accessibilityLabel={`${payment.name}, ${formatMoney(payment.amount)}, ${PAYMENT_LABELS[payment.method]}. Open the order.`}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.65 }]}
          >
            <View style={styles.icon}>
              <Ionicons
                name={payment.method === 'cash' ? 'cash-outline' : 'phone-portrait-outline'}
                size={16}
                color={colors.moneyIn}
              />
            </View>
            <View style={styles.words}>
              <Text style={styles.name} numberOfLines={1}>
                {payment.name}
              </Text>
              <Text style={styles.meta}>
                {PAYMENT_LABELS[payment.method]} · {when(payment.paidAt, unit)}
              </Text>
            </View>
            <Text style={styles.amount}>+{formatMoney(payment.amount)}</Text>
          </Pressable>
        ))
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
    borderBottomColor: colors.border,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.takingsSurface,
  },
  words: { flex: 1, gap: 1 },
  name: { ...type.label, color: colors.text },
  meta: { ...type.caption, color: colors.subtle },
  amount: { ...type.label, fontSize: 15, color: colors.moneyIn },
});