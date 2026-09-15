/**
 * One payment the shop has been told about.
 *
 * The row exists to be held up against a GCash or Maya app, so it is built
 * around the two things that have to match: the amount and the reference
 * number. The reference is set in the shop's monospace face at full size —
 * it is a figure to be compared digit by digit, not a caption, and every
 * other line on the card is smaller than it.
 *
 * Confirming is the shop saying "I found this in my own account". The card
 * never says the money arrived, and the button says what the person is
 * asserting rather than what the app knows.
 */
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button, colors, elevation, formatMoney, mono, space, type } from '@/components/ui-kit';
import { orderPhotoUrl } from '@/lib/api';
import { formatOrderTime } from '@/lib/domain/order-card';
import type { PaymentClaim } from '@/lib/domain/payment-ledger';
import { PAYMENT_LABELS } from '@/lib/domain/payment-summary';

interface PaymentClaimCardProps {
  claim: PaymentClaim;
  now: Date;
  /** Opens the order this payment belongs to. */
  onOpen: () => void;
  /** Absent on a payment already settled. */
  onConfirm?: () => void;
  isConfirming?: boolean;
}

export function PaymentClaimCard({
  claim,
  now,
  onOpen,
  onConfirm,
  isConfirming,
}: PaymentClaimCardProps) {
  const { data: proofUrl } = useQuery({
    queryKey: ['order-photo', claim.proofPath],
    queryFn: () => orderPhotoUrl(claim.proofPath),
    enabled: Boolean(claim.proofPath),
    // Under the signed link's one-hour TTL, so a screen left open refetches
    // before the link dies.
    staleTime: 45 * 60 * 1000,
  });

  const reference = claim.reference
    ? `, reference ${claim.reference}`
    : ', no reference number given';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatMoney(claim.amount)} from ${claim.customerName} by ${PAYMENT_LABELS[claim.method]}${reference}. Open this order.`}
      onPress={onOpen}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.headRow}>
        <Text style={[styles.amount, claim.isConfirmed && styles.amountConfirmed]}>
          {formatMoney(claim.amount)}
        </Text>
        <View style={styles.method}>
          <Text style={styles.methodText}>{PAYMENT_LABELS[claim.method]}</Text>
        </View>
      </View>

      {/* The figure the whole screen is for. */}
      {claim.reference ? (
        <Text style={styles.reference} selectable>
          {claim.reference}
        </Text>
      ) : (
        <Text style={styles.noReference}>No reference number given</Text>
      )}

      <Text style={styles.who}>
        {claim.customerName} · {formatOrderTime(claim.at, now)}
      </Text>

      {proofUrl ? (
        <Image
          source={{ uri: proofUrl }}
          style={styles.proof}
          contentFit="cover"
          accessibilityLabel="Receipt the customer uploaded"
        />
      ) : null}

      {onConfirm ? (
        <Button
          title={isConfirming ? 'Recording…' : 'I received this'}
          onPress={onConfirm}
          disabled={isConfirming}
          accessibilityLabel={`I received ${formatMoney(claim.amount)} from ${claim.customerName}`}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.snug,
    ...elevation.rest,
  },
  pressed: { opacity: 0.85 },

  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  amount: { ...type.section, color: colors.moneyOut },
  /** Settled money is the shop's; it reads in the colour that means received. */
  amountConfirmed: { color: colors.moneyIn },
  method: {
    paddingHorizontal: space.snug,
    paddingVertical: space.tight,
    borderRadius: 999,
    backgroundColor: colors.actionSurface,
  },
  methodText: { ...type.label, fontSize: 12, color: colors.actionInk },

  // Monospace because it is a figure being matched against another figure,
  // not because it should look technical. The spacing is the customer's own.
  reference: {
    fontFamily: mono,
    fontSize: 17,
    letterSpacing: 0.5,
    color: colors.text,
  },
  noReference: { ...type.body, color: colors.subtle, fontStyle: 'italic' },

  who: { ...type.caption, color: colors.subtle },

  proof: {
    width: '100%',
    height: 132,
    borderRadius: 12,
    backgroundColor: colors.sunken,
  },
});
