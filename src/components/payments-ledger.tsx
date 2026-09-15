/**
 * The shop's payments, as a screen.
 *
 * Two sections, because they answer two different questions. "To check" is
 * work: receipts a customer has sent that nobody at the shop has answered
 * yet, oldest first. "Received" is a record: what the shop has confirmed
 * taking, newest first, for when someone asks whether a particular payment
 * ever went through.
 *
 * The list reads the orders the board has already fetched — the same
 * `['shop-orders', shopId]` query — so opening Payments costs no request and
 * confirming one refreshes both views at once.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import { SectionList, StyleSheet, Text, View } from 'react-native';

import { PaymentClaimCard } from '@/components/payment-claim-card';
import { EmptyState, ErrorText, colors, space, type } from '@/components/ui-kit';
import { markOrderPaid } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { paymentLedger, type LedgerOrder, type PaymentClaim } from '@/lib/domain/payment-ledger';

interface PaymentsLedgerProps {
  shopId: string;
  orders: readonly LedgerOrder[];
  onOpenOrder: (orderId: string) => void;
}

export function PaymentsLedger({ shopId, orders, onOpenOrder }: PaymentsLedgerProps) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // Captured once per render so every row dates itself against the same clock.
  const now = new Date();

  const ledger = useMemo(() => paymentLedger(orders), [orders]);

  const confirm = useMutation({
    mutationFn: (claim: PaymentClaim) => markOrderPaid(claim.orderId, claim.method),
    onMutate: (claim: PaymentClaim) => {
      setError('');
      setConfirmingId(claim.orderId);
    },
    onSuccess: () => {
      // The board counts unpaid orders too, so both views move together.
      queryClient.invalidateQueries({ queryKey: ['shop-orders', shopId] });
    },
    onError: (cause: Error) => setError(friendlyMerchantError('save-payment', cause.message)),
    onSettled: () => setConfirmingId(null),
  });

  const sections = useMemo(() => {
    const built: { title: string; note: string; data: PaymentClaim[] }[] = [];
    if (ledger.toCheck.length > 0) {
      built.push({
        title: `To check · ${ledger.toCheck.length}`,
        // The app records a claim; it cannot verify it. Saying so here is the
        // difference between a record and a false assurance.
        note: 'Open your GCash, Maya or bank app and match each reference number before confirming.',
        data: ledger.toCheck,
      });
    }
    if (ledger.confirmed.length > 0) {
      built.push({
        title: 'Received',
        note: 'Payments you have confirmed. Most recent first.',
        data: ledger.confirmed,
      });
    }
    return built;
  }, [ledger]);

  if (sections.length === 0) {
    return (
      <EmptyState message="No payments yet. When a customer sends money and uploads their receipt, it appears here with its reference number." />
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(claim) => claim.orderId}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={error ? <ErrorText>{error}</ErrorText> : null}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionNote}>{section.note}</Text>
        </View>
      )}
      renderItem={({ item }) => (
        <PaymentClaimCard
          claim={item}
          now={now}
          onOpen={() => onOpenOrder(item.orderId)}
          onConfirm={item.isConfirmed ? undefined : () => confirm.mutate(item)}
          isConfirming={confirmingId === item.orderId}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { gap: space.cosy, paddingBottom: space.gulf },
  sectionHead: { gap: space.tight, paddingTop: space.cosy },
  sectionTitle: { ...type.label, fontSize: 13, color: colors.subtle, textTransform: 'uppercase' },
  sectionNote: { ...type.caption, color: colors.subtle },
});
