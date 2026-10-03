/**
 * Bills that come every month: rent, wages, the internet.
 *
 * A recurring bill is a template, never an expense by itself. When its day
 * comes the Expenses screen offers "Rent is due — log ₱8,000?" and logging it
 * writes a normal expense linked back to the bill. Nothing is ever added
 * silently: a month the stall was closed, or the landlord was paid late,
 * should not show money that did not leave.
 *
 * Days 29–31 fall on the last day of a month too short for them, so a bill on
 * the 31st is due 28 February, not skipped.
 */
import type { ExpenseCategory, ExpensePaidFrom } from './expense-categories';
import { isExpenseCategory, isExpensePaidFrom } from './expense-categories';
import { MAX_EXPENSE, MAX_NOTE, parsePesos, type Expense } from './expense-metrics';
import { roundCentavos } from './money';

export interface RecurringExpense {
  id: string;
  shop_id: string;
  amount: number;
  category: ExpenseCategory;
  note: string;
  paid_from: ExpensePaidFrom;
  /** 1–31. */
  day_of_month: number;
  is_active: boolean;
}

export interface RecurringInput {
  amount: number;
  category: ExpenseCategory;
  paid_from: ExpensePaidFrom;
  note: string;
  day_of_month: number;
}

export interface DueBill {
  bill: RecurringExpense;
  /** YYYY-MM-DD in this month. */
  dueOn: string;
}

const pad = (value: number): string => String(value).padStart(2, '0');
const monthOf = (dateKey: string): string => dateKey.slice(0, 7);

/** The day this bill falls on in the month of `today`. */
export function dueDateFor(bill: Pick<RecurringExpense, 'day_of_month'>, today: string): string {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const lastDay = new Date(year, month, 0).getDate();
  return `${monthOf(today)}-${pad(Math.min(bill.day_of_month, lastDay))}`;
}

/** "1st", "2nd", "23rd", "11th". */
export function ordinalDay(day: number): string {
  const teen = day % 100 >= 11 && day % 100 <= 13;
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[day % 10] ?? 'th';
  return `${day}${suffix}`;
}

/**
 * Bills whose day has come this month and that have no expense logged
 * against them this month yet. `expenses` must cover this month.
 */
export function dueBills(
  bills: readonly RecurringExpense[],
  expenses: readonly Expense[],
  today: string
): DueBill[] {
  const month = monthOf(today);
  const loggedThisMonth = new Set(
    expenses
      .filter((expense) => expense.recurring_id && monthOf(expense.spent_on) === month)
      .map((expense) => expense.recurring_id)
  );
  return bills
    .filter((bill) => bill.is_active && !loggedThisMonth.has(bill.id))
    .map((bill) => ({ bill, dueOn: dueDateFor(bill, today) }))
    .filter(({ dueOn }) => dueOn <= today)
    .sort((a, b) => (a.dueOn < b.dueOn ? -1 : a.dueOn > b.dueOn ? 1 : 0));
}

export interface RecurringDraft {
  amountText: string;
  category: ExpenseCategory;
  paidFrom: ExpensePaidFrom;
  note: string;
  dayOfMonth: number;
}

export type RecurringCheck = { ok: true; value: RecurringInput } | { ok: false; error: string };

export function validateRecurringDraft(draft: RecurringDraft): RecurringCheck {
  const amount = parsePesos(draft.amountText);
  if (amount === null || amount <= 0) return { ok: false, error: 'Type how much the bill is, like 8000.' };
  if (amount > MAX_EXPENSE) return { ok: false, error: 'That is more than one bill can be. Check the amount.' };
  if (!isExpenseCategory(draft.category)) return { ok: false, error: 'Pick what the bill is for.' };
  if (!isExpensePaidFrom(draft.paidFrom)) return { ok: false, error: 'Pick how you pay it.' };
  if (!Number.isInteger(draft.dayOfMonth) || draft.dayOfMonth < 1 || draft.dayOfMonth > 31) {
    return { ok: false, error: 'Pick a day from the 1st to the 31st.' };
  }
  const note = draft.note.trim();
  if (note.length > MAX_NOTE) return { ok: false, error: `Keep the note under ${MAX_NOTE} letters.` };
  return {
    ok: true,
    value: {
      amount: roundCentavos(amount),
      category: draft.category,
      paid_from: draft.paidFrom,
      note,
      day_of_month: draft.dayOfMonth,
    },
  };
}
