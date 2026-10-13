/**
 * The counter's side of a reward: on the order, what this customer has earned
 * and one button to use it. The bill drops on the server, so the payment card
 * under this one already asks for the right amount.
 *
 * Stays out of the way when the shop runs no programs. When the order has no
 * phone or account there is nobody to count visits for, and it says so —
 * that is the one fix the counter can make on the spot.
 */
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { applyOrderReward, getOrderRewards, removeOrderReward } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import {
  appliedReward,
  benefitLabel,
  programHeadline,
  rewardAmount,
  stampProgress,
  type RewardProgram,
} from '@/lib/domain/rewards';
import type { OrderRow } from '@/lib/types';

import { Button, Card, ErrorText, Subtle, colors, formatMoney, space, type } from './ui-kit';

function progressLine(program: RewardProgram, visits: number): string {
  if (program.kind === 'stamp_card') {
    const { filled, toGo } = stampProgress(visits, program.visits_needed, program.ready);
    return `${filled} of ${program.visits_needed} stamps · ${toGo} to go`;
  }
  if (program.kind === 'regular') {
    return `${visits} of ${program.visits_needed} visits`;
  }
  return 'Only on a first order';
}

/** The server words its refusals for the counter ("reward: …"); show those as they are. */
function rewardError(message: string): string {
  const prefix = 'reward: ';
  if (!message.startsWith(prefix)) return friendlyMerchantError('save-payment', message);
  const sentence = message.slice(prefix.length);
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

export function OrderRewardsCard({ order }: { order: OrderRow }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [isPending, setIsPending] = useState(false);
  const { data: standing } = useQuery({
    queryKey: ['order-rewards', order.id],
    queryFn: () => getOrderRewards(order.id),
  });

  const applied = appliedReward(order);
  if (!standing || (standing.programs.length === 0 && !applied)) return null;

  // Once the customer has sent money for this bill, changing it would leave
  // them over- or under-paid; the server refuses the same.
  const isLocked =
    order.payment_status === 'paid' ||
    order.status === 'cancelled' ||
    order.payment_proof_path !== null;
  const bill = order.final_total ?? order.estimated_total;

  const run = async (work: () => Promise<unknown>) => {
    setError('');
    setIsPending(true);
    try {
      await work();
      queryClient.invalidateQueries({ queryKey: ['order', order.id] });
      queryClient.invalidateQueries({ queryKey: ['order-rewards', order.id] });
      queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
    } catch (err: unknown) {
      setError(rewardError(err instanceof Error ? err.message : ''));
    } finally {
      setIsPending(false);
    }
  };

  const handleApply = (program: RewardProgram) => {
    const off = rewardAmount(program.benefit, program.benefit_value, bill);
    const gift = benefitLabel(program.benefit, program.benefit_value);
    confirmAction(
      {
        title: 'Use this reward?',
        message: `${gift} takes ${formatMoney(off)} off this order.`,
        confirmLabel: 'Use reward',
        dismissLabel: 'Not now',
      },
      () => run(() => applyOrderReward(order.id, program.id)),
      { isDestructive: false }
    );
  };

  const handleRemove = () =>
    confirmAction(
      {
        title: 'Take the reward off?',
        message: 'The bill goes back to the full price, and the customer keeps the reward for later.',
        confirmLabel: 'Take it off',
        dismissLabel: 'Keep it',
      },
      () => run(() => removeOrderReward(order.id))
    );

  const visitsLabel = `${standing.visits} ${standing.visits === 1 ? 'visit' : 'visits'}`;

  return (
    <Card>
      <View style={styles.head}>
        <Ionicons name="gift" size={20} color={colors.actionInk} />
        <Text style={styles.heading}>Rewards</Text>
        {standing.tracked ? <Text style={styles.visits}>{visitsLabel}</Text> : null}
      </View>

      {applied ? (
        <View style={styles.applied}>
          <Text style={styles.appliedText}>
            {applied.label} · {formatMoney(applied.discount)} off
          </Text>
          {isLocked ? null : (
            <Button
              title="Take reward off"
              variant="outline"
              onPress={handleRemove}
              disabled={isPending}
            />
          )}
        </View>
      ) : !standing.tracked ? (
        <Subtle>
          No phone number on this order, so there are no visits to count. Type the
          customer&apos;s number on their next ticket to start their card.
        </Subtle>
      ) : (
        standing.programs.map((program) => (
          <View key={program.id} style={styles.program}>
            <View style={styles.programText}>
              <Text style={styles.programLine}>{programHeadline(program)}</Text>
              <Text style={[styles.progress, program.ready > 0 && styles.progressReady]}>
                {program.ready > 0 ? 'Earned, ready to use' : progressLine(program, standing.visits)}
              </Text>
            </View>
            {program.ready > 0 && !isLocked ? (
              <Button title="Use" onPress={() => handleApply(program)} disabled={isPending} />
            ) : null}
          </View>
        ))
      )}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  heading: { ...type.section, color: colors.text, flex: 1 },
  visits: { ...type.label, color: colors.subtle },
  applied: { gap: space.snug },
  appliedText: { ...type.body, fontWeight: '700', color: colors.moneyIn },
  program: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingTop: space.snug,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  programText: { flex: 1, gap: 2 },
  programLine: { ...type.label, color: colors.text },
  progress: { ...type.caption, color: colors.subtle },
  progressReady: { color: colors.moneyIn, fontWeight: '700' },
});
