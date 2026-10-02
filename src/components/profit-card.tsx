/**
 * What the period left the shop: money in, money out, and the difference.
 *
 * Sits under the takings on the Sales screen so a good month is read against
 * its rent. "Collected" is the same figure as the hero's sales — paid on the
 * day — and "Spent" counts expenses on the day they were paid, so the
 * subtraction is like for like. A loss is said plainly, in the owed amber
 * rather than alarm red: it is a fact about the month, not an error.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '@/lib/domain/money';

import { RADII, colors, elevation, space, type } from './ui-kit';

function Line({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

export function ProfitCard({
  collected,
  spent,
  profit,
  marginPct,
  expenseCount,
  isLoading,
  onAddExpense,
  onOpenExpenses,
}: {
  collected: number;
  spent: number;
  profit: number;
  marginPct: number | null;
  expenseCount: number;
  isLoading: boolean;
  onAddExpense: () => void;
  onOpenExpenses: () => void;
}) {
  const isLoss = profit < 0;
  const profitTone = isLoss ? colors.moneyOut : colors.moneyIn;

  return (
    <View style={styles.card}>
      <Line label="Collected" value={formatMoney(collected)} tone={colors.moneyIn} />
      <Line label="Spent" value={isLoading ? '…' : `− ${formatMoney(spent)}`} />
      <View style={styles.rule} />
      <View style={styles.line}>
        <Text style={styles.profitLabel}>{isLoss ? 'Loss' : 'Profit'}</Text>
        <View style={styles.profitRight}>
          <Text style={[styles.profitValue, { color: profitTone }]} accessibilityRole="header">
            {isLoading ? '…' : formatMoney(profit)}
          </Text>
          {marginPct !== null && !isLoading ? (
            <Text style={styles.margin}>{marginPct}% of what came in</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onAddExpense}
          accessibilityRole="button"
          style={({ pressed }) => [styles.add, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="add" size={18} color={colors.onAccent} />
          <Text style={styles.addText}>Add expense</Text>
        </Pressable>
        <Pressable
          onPress={onOpenExpenses}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.open, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.openText}>
            {expenseCount === 0 ? 'Expenses' : `${expenseCount} expense${expenseCount === 1 ? '' : 's'}`}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.actionInk} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.snug,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  line: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.snug },
  lineLabel: { ...type.body, color: colors.subtle },
  lineValue: { ...type.label, color: colors.text },
  rule: { height: 1, backgroundColor: colors.border, marginVertical: space.tight },
  profitLabel: { ...type.label, color: colors.text },
  profitRight: { alignItems: 'flex-end', gap: 2 },
  profitValue: { ...type.value },
  margin: { ...type.caption, color: colors.subtle },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.snug,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.cosy,
    height: 36,
    borderRadius: RADII.pill,
    backgroundColor: colors.action,
  },
  addText: { ...type.label, color: colors.onAccent },
  open: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  openText: { ...type.caption, fontWeight: '700', color: colors.actionInk },
});
