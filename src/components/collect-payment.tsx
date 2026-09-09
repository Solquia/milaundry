/**
 * Taking the money.
 *
 * This used to be one button reading "Mark as paid": no amount on it, no
 * method choice, no cash arithmetic, no confirmation, and a silent re-render
 * as the only sign it had worked. At a counter that silence is exactly when
 * people reopen the app to check. Now the amount is on the button and on the
 * confirmation, cash gets tender-and-change, and the result is announced.
 *
 * There is deliberately no undo: the backend has no reverse-payment call, so
 * the confirmation beforehand is the safeguard rather than a promise after.
 */
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { orderPhotoUrl, type OrderWithDetails } from '@/lib/api';
import { changeFor, parseAmount, tenderSuggestions } from '@/lib/domain/cash-payment';
import { merchantProofCopy } from '@/lib/domain/payment-proof';
import { PAYMENT_LABELS } from '@/lib/domain/payment-summary';
import type { PaymentMethod } from '@/lib/domain/walk-in-order';

import { Button, Field, RADII, Subtle, colors, formatMoney, space, type } from './ui-kit';

/**
 * The three ways almost every neighbourhood laundry actually gets paid. The
 * rest stay behind a disclosure so the money moment is a three-way choice
 * rather than a six-button grid.
 */
const COMMON_METHODS: readonly PaymentMethod[] = ['cash', 'gcash', 'maya'];
const OTHER_METHODS: readonly PaymentMethod[] = ['card', 'bank_transfer', 'other'];

export function CollectPayment({
  total,
  method,
  onChangeMethod,
  onConfirm,
  isPending,
}: {
  total: number;
  method: PaymentMethod;
  onChangeMethod: (method: PaymentMethod) => void;
  onConfirm: (tendered?: number) => void;
  isPending: boolean;
}) {
  const [showAllMethods, setShowAllMethods] = useState(false);
  const [tenderInput, setTenderInput] = useState('');

  const isCash = method === 'cash';
  const tendered = isCash ? parseAmount(tenderInput) : null;
  const cash = tendered === null ? null : changeFor(total, tendered);
  const visibleMethods = showAllMethods ? [...COMMON_METHODS, ...OTHER_METHODS] : COMMON_METHODS;
  const isShort = Boolean(cash && !cash.isEnough);

  return (
    <>
      <Text style={styles.dueLabel}>To collect</Text>
      <Text style={styles.dueAmount}>{formatMoney(total)}</Text>

      <Text style={styles.fieldHeading}>How did the customer pay?</Text>
      <View style={styles.methodRow}>
        {visibleMethods.map((option) => (
          <View key={option} style={styles.methodSlot}>
            <Button
              title={PAYMENT_LABELS[option]}
              variant={method === option ? 'primary' : 'outline'}
              onPress={() => onChangeMethod(option)}
            />
          </View>
        ))}
      </View>
      {!showAllMethods && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowAllMethods(true)}
          hitSlop={8}
          style={styles.disclosure}
        >
          <Text style={styles.disclosureText}>Another way to pay</Text>
        </Pressable>
      )}

      {isCash && (
        <View style={styles.cashBlock}>
          <Text style={styles.fieldHeading}>How much cash did they hand over?</Text>
          <View style={styles.tenderRow}>
            {tenderSuggestions(total).map((amount) => (
              <Pressable
                key={amount}
                accessibilityRole="button"
                accessibilityLabel={`Received ${formatMoney(amount)}`}
                accessibilityState={{ selected: tendered === amount }}
                onPress={() => setTenderInput(String(amount))}
                hitSlop={8}
                style={[styles.tenderChip, tendered === amount && styles.tenderChipSelected]}
              >
                <Text
                  style={[
                    styles.tenderChipText,
                    tendered === amount && styles.tenderChipTextSelected,
                  ]}
                >
                  {formatMoney(amount)}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Or type the amount"
            value={tenderInput}
            onChangeText={setTenderInput}
            keyboardType="decimal-pad"
            placeholder="3000"
            accessibilityLabel="Cash received from customer"
          />
          {cash ? (
            <Text
              style={[styles.changeLine, isShort && styles.changeLineShort]}
              accessibilityLiveRegion="polite"
            >
              {cash.isEnough
                ? // An instruction, not a label: the owner is about to count
                  // notes out of the drawer.
                  `Give ${formatMoney(cash.change)} change`
                : `Short by ${formatMoney(cash.shortfall)}. That is not enough for this order.`}
            </Text>
          ) : (
            <Subtle>Leave this blank if they paid the exact amount.</Subtle>
          )}
        </View>
      )}

      <Button
        title={isPending ? 'Recording…' : `Mark ${formatMoney(total)} as paid`}
        onPress={() => onConfirm(isCash && cash?.isEnough ? (tendered ?? undefined) : undefined)}
        disabled={isPending || isShort}
      />
    </>
  );
}

/**
 * The customer's claim, laid beside the button that would confirm it.
 *
 * The app cannot see the shop's wallet, so this never says "payment
 * received" — it shows the screenshot and the reference the customer sent,
 * and `merchantProofCopy` says the rest: check your own app first.
 */
export function ProofReview({ order }: { order: OrderWithDetails }) {
  const copy = merchantProofCopy('submitted');
  const { data: proofUrl } = useQuery({
    queryKey: ['order-photo', order.payment_proof_path],
    queryFn: () => orderPhotoUrl(order.payment_proof_path),
    enabled: Boolean(order.payment_proof_path),
    // Under the signed link's one-hour TTL, so a screen left open refetches
    // before the link dies.
    staleTime: 45 * 60 * 1000,
  });

  return (
    <View style={styles.proofBlock}>
      <Text style={styles.proofTitle}>{copy.title}</Text>
      {proofUrl ? (
        <View style={styles.proofFrame}>
          <Image
            source={{ uri: proofUrl }}
            style={styles.proofImage}
            contentFit="cover"
            accessibilityLabel="Receipt the customer uploaded"
          />
        </View>
      ) : null}
      {order.payment_reference ? (
        <Text style={styles.proofReference}>Ref: {order.payment_reference}</Text>
      ) : null}
      <Subtle>{copy.body}</Subtle>
    </View>
  );
}

const styles = StyleSheet.create({
  dueLabel: { ...type.label, fontSize: 13, color: colors.subtle },
  // The one figure this card exists to deliver, in the colour that means the
  // shop has not been paid it yet.
  dueAmount: { ...type.hero, fontWeight: '800', color: colors.moneyOut },
  fieldHeading: { ...type.label, fontSize: 13, color: colors.subtle, marginTop: space.snug },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  methodSlot: { minWidth: 96, flexGrow: 1 },
  disclosure: { paddingVertical: space.snug },
  disclosureText: { ...type.label, color: colors.actionInk },
  cashBlock: { gap: space.snug },
  tenderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  tenderChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tenderChipSelected: { borderColor: colors.action, backgroundColor: colors.action },
  tenderChipText: { ...type.label, color: colors.text },
  tenderChipTextSelected: { color: colors.onAccent },
  // Change owed back is money leaving the drawer but the sale is settled —
  // green here reads "done", which is what the owner needs at that moment.
  changeLine: { fontSize: 18, fontWeight: '700', color: colors.moneyIn },
  changeLineShort: { color: colors.danger },

  /** The customer's receipt, boxed apart from the shop's own controls. */
  proofBlock: {
    gap: space.snug,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADII.card,
    backgroundColor: colors.sunken,
    padding: space.cosy,
  },
  proofTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  proofFrame: { height: 180, borderRadius: 8, overflow: 'hidden' },
  proofImage: { width: '100%', height: '100%' },
  proofReference: { ...type.label, color: colors.text },
});
