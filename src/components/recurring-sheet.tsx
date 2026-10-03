/**
 * A bill that comes every month: what it is, how much, which day, paid how.
 *
 * Opened from the Expenses screen's "Every month" list to add a bill or
 * change one. "Stop repeating" keeps the bill and its history but stops it
 * being offered; a stopped bill can be started again. Changing a bill never
 * rewrites the expenses already logged from it — those were what was paid.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createRecurringExpense, updateRecurringExpense } from '@/lib/api';
import {
  CATEGORY_LOOKS,
  EXPENSE_CATEGORIES,
  EXPENSE_PAID_FROM,
  PAID_FROM_LABELS,
  type ExpenseCategory,
  type ExpensePaidFrom,
} from '@/lib/domain/expense-categories';
import {
  ordinalDay,
  validateRecurringDraft,
  type RecurringExpense,
  type RecurringInput,
} from '@/lib/domain/expense-recurring';
import { invalidateShopExpenses } from '@/lib/use-shop-expenses';

import { ChoiceChip } from './choice-chip';
import { SalesSheet } from './sales-sheet';
import { Button, ErrorText, Field, RADII, colors, space, type } from './ui-kit';

const SAVE_FAILED = 'Could not save. Check your connection and try again.';
const FIRST_DAY = 1;
const LAST_DAY = 31;

export function RecurringSheet({
  visible,
  shopId,
  bill,
  onSaved,
  onClose,
}: {
  visible: boolean;
  shopId: string;
  /** A bill to change, or null to add one. */
  bill: RecurringExpense | null;
  onSaved: (message: string) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [amountText, setAmountText] = useState(bill ? String(bill.amount) : '');
  const [category, setCategory] = useState<ExpenseCategory>(bill?.category ?? 'rent');
  const [paidFrom, setPaidFrom] = useState<ExpensePaidFrom>(bill?.paid_from ?? 'cash');
  const [note, setNote] = useState(bill?.note ?? '');
  const [dayOfMonth, setDayOfMonth] = useState(bill?.day_of_month ?? FIRST_DAY);
  const [error, setError] = useState('');

  const done = async (message: string) => {
    await invalidateShopExpenses(queryClient, shopId);
    onSaved(message);
  };

  const save = useMutation({
    mutationFn: async (input: RecurringInput) => {
      if (bill) await updateRecurringExpense(bill.id, input);
      else await createRecurringExpense(shopId, input);
    },
    onSuccess: () => done(bill ? 'Bill updated.' : 'Bill added. It will be offered when it falls due.'),
    onError: () => setError(SAVE_FAILED),
  });

  const toggle = useMutation({
    mutationFn: () => updateRecurringExpense(bill!.id, { is_active: !bill!.is_active }),
    onSuccess: () => done(bill?.is_active ? 'Bill stopped.' : 'Bill started again.'),
    onError: () => setError(SAVE_FAILED),
  });

  const submit = () => {
    const check = validateRecurringDraft({ amountText, category, paidFrom, note, dayOfMonth });
    if (!check.ok) {
      setError(check.error);
      return;
    }
    save.mutate(check.value);
  };

  const isBusy = save.isPending || toggle.isPending;
  const stepDay = (direction: -1 | 1) =>
    setDayOfMonth((day) => Math.min(LAST_DAY, Math.max(FIRST_DAY, day + direction)));

  return (
    <SalesSheet
      visible={visible}
      title={bill ? 'Monthly bill' : 'Add a monthly bill'}
      subtitle="Offered on its day; never logged on its own"
      onClose={onClose}
    >
      <Field
        label="Amount each month (₱)"
        value={amountText}
        onChangeText={(next) => {
          setAmountText(next);
          setError('');
        }}
        keyboardType="decimal-pad"
        placeholder="8000"
      />

      <View style={styles.group}>
        <Text style={styles.label}>What for</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {EXPENSE_CATEGORIES.map((key) => (
            <ChoiceChip
              key={key}
              label={CATEGORY_LOOKS[key].label}
              icon={CATEGORY_LOOKS[key].icon}
              isOn={category === key}
              onPress={() => setCategory(key)}
            />
          ))}
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Due every month on the</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => stepDay(-1)}
            accessibilityRole="button"
            accessibilityLabel="Earlier day"
            hitSlop={8}
            style={styles.stepButton}
          >
            <Ionicons name="remove" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.day} accessibilityLiveRegion="polite">
            {ordinalDay(dayOfMonth)}
            {dayOfMonth > 28 ? ' (or the month’s last day)' : ''}
          </Text>
          <Pressable
            onPress={() => stepDay(1)}
            accessibilityRole="button"
            accessibilityLabel="Later day"
            hitSlop={8}
            style={styles.stepButton}
          >
            <Ionicons name="add" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Paid with</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {EXPENSE_PAID_FROM.map((key) => (
            <ChoiceChip key={key} label={PAID_FROM_LABELS[key]} isOn={paidFrom === key} onPress={() => setPaidFrom(key)} />
          ))}
        </View>
      </View>

      <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Stall rent, Meralco…" maxLength={200} />

      <ErrorText>{error}</ErrorText>
      <Button title={save.isPending ? 'Saving…' : 'Save bill'} onPress={submit} disabled={isBusy} />
      {bill ? (
        <Button
          title={bill.is_active ? 'Stop repeating' : 'Start again'}
          variant="outline"
          onPress={() => toggle.mutate()}
          disabled={isBusy}
        />
      ) : null}
    </SalesSheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.snug },
  label: { ...type.label, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.tight,
    borderRadius: RADII.pill,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepButton: {
    width: 36,
    height: 36,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  day: { ...type.label, color: colors.text, flexShrink: 1, textAlign: 'center' },
});
