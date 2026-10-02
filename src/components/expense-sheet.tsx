/**
 * Logging one expense: how much, what for, which day, paid with what.
 *
 * Built to take under ten seconds at the counter. The amount field has focus
 * when the sheet opens, the day defaults to today and steps back with one tap
 * for a receipt found in a pocket, and cash is already picked because most of
 * a laundry shop's spending leaves from the drawer. Opening it on a saved
 * expense edits it, and only there does "Delete" appear — behind a second tap.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createShopExpense, deleteShopExpense, updateShopExpense } from '@/lib/api';
import {
  CATEGORY_LOOKS,
  EXPENSE_CATEGORIES,
  EXPENSE_PAID_FROM,
  PAID_FROM_LABELS,
  type ExpenseCategory,
  type ExpensePaidFrom,
} from '@/lib/domain/expense-categories';
import {
  dayLabel,
  shiftDateKey,
  validateExpenseDraft,
  type Expense,
  type ExpenseInput,
} from '@/lib/domain/expense-metrics';
import { invalidateShopExpenses } from '@/lib/use-shop-expenses';

import { SalesSheet } from './sales-sheet';
import { Button, ErrorText, Field, RADII, colors, space, type } from './ui-kit';

const SAVE_FAILED = 'Could not save. Check your connection and try again.';
const DELETE_FAILED = 'Could not delete. Check your connection and try again.';

function Chip({
  label,
  icon,
  isOn,
  onPress,
}: {
  label: string;
  icon?: string;
  isOn: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected: isOn }}
      style={({ pressed }) => [styles.chip, isOn && styles.chipOn, pressed && { opacity: 0.7 }]}
    >
      {icon ? <Ionicons name={icon as never} size={15} color={isOn ? colors.onAccent : colors.actionInk} /> : null}
      <Text style={[styles.chipText, isOn && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function ExpenseSheet({
  visible,
  shopId,
  expense,
  today,
  onSaved,
  onClose,
}: {
  visible: boolean;
  shopId: string;
  /** A saved expense to edit, or null to log a new one. */
  expense: Expense | null;
  /** Today as YYYY-MM-DD, from the screen's clock. */
  today: string;
  onSaved: (message: string) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [amountText, setAmountText] = useState(expense ? String(expense.amount) : '');
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'supplies');
  const [spentOn, setSpentOn] = useState(expense?.spent_on ?? today);
  const [paidFrom, setPaidFrom] = useState<ExpensePaidFrom>(expense?.paid_from ?? 'cash');
  const [note, setNote] = useState(expense?.note ?? '');
  const [error, setError] = useState('');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const save = useMutation({
    mutationFn: (input: ExpenseInput) =>
      expense ? updateShopExpense(expense.id, input) : createShopExpense(shopId, input),
    onSuccess: async () => {
      await invalidateShopExpenses(queryClient, shopId);
      onSaved(expense ? 'Expense updated.' : 'Expense saved.');
    },
    onError: () => setError(SAVE_FAILED),
  });

  const remove = useMutation({
    mutationFn: () => deleteShopExpense(expense!.id),
    onSuccess: async () => {
      await invalidateShopExpenses(queryClient, shopId);
      onSaved('Expense deleted.');
    },
    onError: () => setError(DELETE_FAILED),
  });

  const isBusy = save.isPending || remove.isPending;
  const clearError = () => setError('');

  const submit = () => {
    const check = validateExpenseDraft({ amountText, category, spentOn, paidFrom, note }, today);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    save.mutate(check.value);
  };

  const onDelete = () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    remove.mutate();
  };

  const canStepForward = spentOn < today;

  return (
    <SalesSheet
      visible={visible}
      title={expense ? 'Edit expense' : 'Add expense'}
      subtitle="Only owners see this"
      onClose={onClose}
    >
      <Field
        label="Amount (₱)"
        value={amountText}
        onChangeText={(next) => {
          setAmountText(next);
          clearError();
        }}
        keyboardType="decimal-pad"
        placeholder="350"
        autoFocus={!expense}
        returnKeyType="done"
      />

      <View style={styles.group}>
        <Text style={styles.label}>What for</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {EXPENSE_CATEGORIES.map((key) => (
            <Chip
              key={key}
              label={CATEGORY_LOOKS[key].label}
              icon={CATEGORY_LOOKS[key].icon}
              isOn={category === key}
              onPress={() => {
                setCategory(key);
                clearError();
              }}
            />
          ))}
        </View>
        <Text style={styles.hint}>{CATEGORY_LOOKS[category].hint}</Text>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Paid on</Text>
        <View style={styles.stepper}>
          <Pressable
            onPress={() => setSpentOn(shiftDateKey(spentOn, -1))}
            accessibilityRole="button"
            accessibilityLabel="Day before"
            hitSlop={8}
            style={({ pressed }) => [styles.stepButton, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.day} accessibilityLiveRegion="polite">
            {dayLabel(spentOn, today)}
          </Text>
          <Pressable
            onPress={canStepForward ? () => setSpentOn(shiftDateKey(spentOn, 1)) : undefined}
            disabled={!canStepForward}
            accessibilityRole="button"
            accessibilityLabel="Day after"
            accessibilityState={{ disabled: !canStepForward }}
            hitSlop={8}
            style={({ pressed }) => [
              styles.stepButton,
              !canStepForward && styles.stepOff,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>Paid with</Text>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {EXPENSE_PAID_FROM.map((key) => (
            <Chip key={key} label={PAID_FROM_LABELS[key]} isOn={paidFrom === key} onPress={() => setPaidFrom(key)} />
          ))}
        </View>
      </View>

      <Field
        label={category === 'other' ? 'Note' : 'Note (optional)'}
        value={note}
        onChangeText={(next) => {
          setNote(next);
          clearError();
        }}
        placeholder="Meralco, 2 gallons Ariel…"
        maxLength={200}
      />

      <ErrorText>{error}</ErrorText>
      <Button title={save.isPending ? 'Saving…' : 'Save expense'} onPress={submit} disabled={isBusy} />
      {expense ? (
        <Button
          title={isConfirmingDelete ? 'Tap again to delete' : 'Delete expense'}
          variant={isConfirmingDelete ? 'danger' : 'outline'}
          onPress={onDelete}
          disabled={isBusy}
        />
      ) : null}
    </SalesSheet>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.snug },
  label: { ...type.label, color: colors.text },
  hint: { ...type.caption, color: colors.subtle },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.cosy,
    paddingVertical: space.snug,
    borderRadius: RADII.pill,
    backgroundColor: colors.actionSurface,
  },
  chipOn: { backgroundColor: colors.action },
  chipText: { ...type.label, color: colors.actionInk },
  chipTextOn: { color: colors.onAccent },
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
  stepOff: { opacity: 0.3 },
  day: { ...type.label, color: colors.text },
});
