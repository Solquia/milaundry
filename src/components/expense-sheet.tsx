/**
 * Logging one expense: how much, what for, which day, paid with what.
 *
 * Built to take under ten seconds at the counter. The amount field has focus
 * when the sheet opens, the day defaults to today and steps back with one tap
 * for a receipt found in a pocket, and cash is already picked because most of
 * a laundry shop's spending leaves from the drawer. Opening it on a saved
 * expense edits it, and only there does "Delete" appear — behind a second tap.
 *
 * A new expense can be marked "repeat every month": that saves a recurring
 * bill on the same day of the month and links this expense as its first
 * month, so the Expenses screen offers it again next month (0040).
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  createRecurringExpense,
  createShopExpense,
  deleteRecurringExpense,
  deleteShopExpense,
  removeExpenseReceipt,
  updateShopExpense,
  uploadExpenseReceipt,
} from '@/lib/api';
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
import { ordinalDay } from '@/lib/domain/expense-recurring';
import { invalidateShopExpenses } from '@/lib/use-shop-expenses';

import { ChoiceChip } from './choice-chip';
import { ReceiptField } from './receipt-field';
import { SalesSheet } from './sales-sheet';
import { Button, ErrorText, Field, RADII, colors, space, type } from './ui-kit';

const SAVE_FAILED = 'Could not save. Check your connection and try again.';
const DELETE_FAILED = 'Could not delete. Check your connection and try again.';

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
  const [receiptUri, setReceiptUri] = useState<string | null>(null);
  const [keptReceipt, setKeptReceipt] = useState<string | null>(expense?.receipt_path ?? null);
  const [isRepeating, setIsRepeating] = useState(false);

  const save = useMutation({
    mutationFn: async (input: ExpenseInput) => {
      const uploaded = receiptUri ? await uploadExpenseReceipt(shopId, receiptUri) : null;
      const receipt_path = uploaded ?? keptReceipt;
      let recurring_id: string | null = null;
      try {
        if (expense) {
          await updateShopExpense(expense.id, { ...input, receipt_path });
        } else {
          recurring_id = isRepeating
            ? await createRecurringExpense(shopId, {
                amount: input.amount,
                category: input.category,
                paid_from: input.paid_from,
                note: input.note,
                day_of_month: Number(input.spent_on.slice(8, 10)),
              })
            : null;
          await createShopExpense(shopId, { ...input, receipt_path, recurring_id });
        }
      } catch (failure) {
        // Undo what this attempt made, so a retry does not leave a second bill
        // or an orphaned photo behind. Best effort: the save error is what matters.
        if (recurring_id) await deleteRecurringExpense(recurring_id).catch(() => undefined);
        if (uploaded) await removeExpenseReceipt(uploaded).catch(() => undefined);
        throw failure;
      }
      const replaced = expense?.receipt_path;
      if (replaced && replaced !== receipt_path) await removeExpenseReceipt(replaced).catch(() => undefined);
    },
    onSuccess: async () => {
      await invalidateShopExpenses(queryClient, shopId);
      onSaved(expense ? 'Expense updated.' : 'Expense saved.');
    },
    onError: () => setError(SAVE_FAILED),
  });

  const remove = useMutation({
    mutationFn: async () => {
      await deleteShopExpense(expense!.id);
      if (expense?.receipt_path) await removeExpenseReceipt(expense.receipt_path).catch(() => undefined);
    },
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
            <ChoiceChip
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
            <ChoiceChip key={key} label={PAID_FROM_LABELS[key]} isOn={paidFrom === key} onPress={() => setPaidFrom(key)} />
          ))}
        </View>
      </View>

      {expense ? null : (
        <View style={styles.repeat}>
          <View style={styles.repeatWords}>
            <Text style={styles.label}>Repeat every month</Text>
            <Text style={styles.hint}>
              {`Offer it again on the ${ordinalDay(Number(spentOn.slice(8, 10)))} — for rent, wages, bills`}
            </Text>
          </View>
          <Switch
            value={isRepeating}
            onValueChange={setIsRepeating}
            accessibilityLabel="Repeat every month"
            trackColor={{ true: colors.action, false: colors.borderStrong }}
          />
        </View>
      )}

      <ReceiptField
        localUri={receiptUri}
        savedPath={keptReceipt}
        onPick={setReceiptUri}
        onRemove={() => {
          setReceiptUri(null);
          setKeptReceipt(null);
        }}
      />

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
  repeat: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  repeatWords: { flex: 1, gap: 2 },
});
