/**
 * Monthly bills on the Expenses screen: the ones due now, each one tap from
 * being logged, and every bill the shop pays monthly, each one tap from
 * being changed.
 *
 * "Due" is amber like money owed to someone, because it is; once logged it
 * leaves the list until next month.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LOOKS } from '@/lib/domain/expense-categories';
import { dayLabel } from '@/lib/domain/expense-metrics';
import { ordinalDay, type DueBill, type RecurringExpense } from '@/lib/domain/expense-recurring';
import { formatMoney } from '@/lib/domain/money';

import { glassPane, vibrantPane } from './glass';
import { RADII, TAG_TONES, colors, space, type } from './ui-kit';

const billName = (bill: RecurringExpense): string => bill.note || CATEGORY_LOOKS[bill.category].label;

export function DueBills({
  due,
  today,
  loggingId,
  onLog,
}: {
  due: readonly DueBill[];
  today: string;
  /** The bill being logged right now, so its button can say so. */
  loggingId: string | null;
  onLog: (item: DueBill) => void;
}) {
  if (due.length === 0) return null;
  return (
    <View style={[styles.card, styles.dueCard]}>
      {due.map((item) => {
        const isLogging = loggingId === item.bill.id;
        return (
          <View key={item.bill.id} style={styles.row}>
            <Ionicons name="alarm-outline" size={18} color={TAG_TONES.owed.ink} />
            <View style={styles.words}>
              <Text style={styles.title} numberOfLines={1}>
                {billName(item.bill)} is due
              </Text>
              <Text style={styles.hint}>
                {formatMoney(item.bill.amount)} · {dayLabel(item.dueOn, today)}
              </Text>
            </View>
            <Pressable
              onPress={() => onLog(item)}
              disabled={loggingId !== null}
              accessibilityRole="button"
              accessibilityLabel={`Log ${billName(item.bill)}, ${formatMoney(item.bill.amount)}`}
              style={({ pressed }) => [styles.log, (pressed || isLogging) && { opacity: 0.7 }]}
            >
              <Text style={styles.logText}>{isLogging ? 'Logging…' : 'Log it'}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function MonthlyBillList({
  bills,
  onOpen,
}: {
  bills: readonly RecurringExpense[];
  onOpen: (bill: RecurringExpense | null) => void;
}) {
  return (
    <View style={styles.card}>
      {bills.map((bill) => (
        <Pressable
          key={bill.id}
          onPress={() => onOpen(bill)}
          accessibilityRole="button"
          accessibilityHint="Change or stop this bill"
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name={CATEGORY_LOOKS[bill.category].icon as never} size={18} color={colors.subtle} />
          <View style={styles.words}>
            <Text style={[styles.title, !bill.is_active && styles.stopped]} numberOfLines={1}>
              {billName(bill)}
            </Text>
            <Text style={styles.hint}>
              {bill.is_active ? `Every month on the ${ordinalDay(bill.day_of_month)}` : 'Stopped'}
            </Text>
          </View>
          <Text style={[styles.amount, !bill.is_active && styles.stopped]}>{formatMoney(bill.amount)}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => onOpen(null)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.add, pressed && { opacity: 0.6 }]}
      >
        <Ionicons name="add-circle-outline" size={18} color={colors.actionInk} />
        <Text style={styles.addText}>{bills.length === 0 ? 'Add rent, wages or a bill' : 'Add a monthly bill'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    ...glassPane,
    gap: space.snug,
    padding: space.room,
  },
  dueCard: { ...vibrantPane(TAG_TONES.owed.ink) },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, paddingVertical: space.tight },
  words: { flex: 1, gap: 2 },
  title: { ...type.label, color: colors.text },
  hint: { ...type.caption, color: colors.subtle },
  amount: { ...type.label, color: colors.text },
  stopped: { color: colors.subtle, textDecorationLine: 'line-through' },
  log: {
    paddingHorizontal: space.cosy,
    height: 34,
    justifyContent: 'center',
    borderRadius: RADII.pill,
    backgroundColor: colors.action,
  },
  logText: { ...type.label, color: colors.onAccent },
  add: { flexDirection: 'row', alignItems: 'center', gap: space.snug, paddingTop: space.tight },
  addText: { ...type.label, color: colors.actionInk },
});
