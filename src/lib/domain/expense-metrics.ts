/**
 * What the shop spent in a period, and what that leaves of what came in.
 *
 * An expense is dated by the calendar day it was paid (`spent_on`, a plain
 * YYYY-MM-DD), not by a timestamp. "September's electricity" is a September
 * cost on every phone whatever its clock says, and an owner logging Monday's
 * detergent on Wednesday picks Monday — the day, not the moment of typing.
 *
 * Revenue on the Sales screen counts money on the day it was *paid*; expenses
 * count on the day they were paid too. Both sides on the same cash clock is
 * what makes "profit" an honest subtraction.
 */
import {
  CATEGORY_LOOKS,
  isExpenseCategory,
  isExpensePaidFrom,
  type ExpenseCategory,
  type ExpensePaidFrom,
} from './expense-categories';
import { roundCentavos } from './money';
import { percentChange } from './sales-metrics';
import type { PeriodFrame } from './sales-period';

export interface Expense {
  id: string;
  shop_id: string;
  /** The calendar day it was paid, YYYY-MM-DD. */
  spent_on: string;
  amount: number;
  category: ExpenseCategory;
  note: string;
  paid_from: ExpensePaidFrom;
  created_at: string;
  /** The recurring bill this logs, once per month (0040). */
  recurring_id: string | null;
  /** `<shop_id>/receipt-<ms>.<ext>` in the private shop-receipts bucket (0040). */
  receipt_path: string | null;
}

/** What the sheet sends to the database, already checked. */
export interface ExpenseInput {
  amount: number;
  category: ExpenseCategory;
  spent_on: string;
  paid_from: ExpensePaidFrom;
  note: string;
  receipt_path?: string | null;
  recurring_id?: string | null;
}

export interface CategoryShare {
  key: ExpenseCategory;
  label: string;
  amount: number;
  /** Whole percent of the period's spending. */
  share: number;
}

export interface ExpenseDay {
  date: string;
  total: number;
  items: Expense[];
}

export interface ExpenseSummary {
  total: number;
  count: number;
  /** The comparison period up to the same point. */
  compareTotal: number;
  delta: number;
  deltaPct: number | null;
  byCategory: CategoryShare[];
  /** Newest day first. */
  days: ExpenseDay[];
}

/** The largest single expense the app accepts; the column allows more, a typo should not. */
export const MAX_EXPENSE = 1_000_000;
export const MAX_NOTE = 200;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DATE_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number): string => String(value).padStart(2, '0');

/** A local date as YYYY-MM-DD. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a YYYY-MM-DD, or NaN when it is not a real day. */
export function dateKeyToTime(key: string): number {
  const match = DATE_KEY.exec(key);
  if (!match) return NaN;
  const [y, m, d] = [Number(match[1]), Number(match[2]) - 1, Number(match[3])];
  const date = new Date(y, m, d);
  return date.getFullYear() === y && date.getMonth() === m && date.getDate() === d ? date.getTime() : NaN;
}

export function shiftDateKey(key: string, days: number): string {
  const date = new Date(dateKeyToTime(key));
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/** "Today", "Yesterday", or "Mon 28 Sep". */
export function dayLabel(key: string, today: string): string {
  if (key === today) return 'Today';
  if (key === shiftDateKey(today, -1)) return 'Yesterday';
  const date = new Date(dateKeyToTime(key));
  return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** The dates to fetch for a frame: the comparison period through this one, `to` exclusive. */
export function expenseRange(frame: PeriodFrame): { from: string; to: string } {
  return { from: toDateKey(new Date(frame.compareStart)), to: toDateKey(new Date(frame.end)) };
}

const sumOf = (items: readonly Expense[]): number =>
  roundCentavos(items.reduce((sum, item) => sum + item.amount, 0));

function sharesOf(items: readonly Expense[], total: number): CategoryShare[] {
  const byKey = new Map<ExpenseCategory, number>();
  for (const item of items) byKey.set(item.category, (byKey.get(item.category) ?? 0) + item.amount);
  return [...byKey.entries()]
    .map(([key, amount]) => ({
      key,
      label: CATEGORY_LOOKS[key].label,
      amount: roundCentavos(amount),
      share: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

function daysOf(items: readonly Expense[]): ExpenseDay[] {
  const byDate = new Map<string, Expense[]>();
  for (const item of items) byDate.set(item.spent_on, [...(byDate.get(item.spent_on) ?? []), item]);
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, dayItems]) => ({
      date,
      total: sumOf(dayItems),
      items: [...dayItems].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
    }));
}

export function summarizeExpenses(expenses: readonly Expense[], frame: PeriodFrame): ExpenseSummary {
  const dated = expenses
    .map((item) => ({ item, time: dateKeyToTime(item.spent_on) }))
    .filter(({ time }) => Number.isFinite(time));
  const inPeriod = dated
    .filter(({ time }) => time >= frame.start && time < frame.end && time < frame.cutoff)
    .map(({ item }) => item);
  const inCompare = dated
    .filter(({ time }) => time >= frame.compareStart && time < frame.compareCutoff)
    .map(({ item }) => item);

  const total = sumOf(inPeriod);
  const compareTotal = sumOf(inCompare);

  return {
    total,
    count: inPeriod.length,
    compareTotal,
    delta: roundCentavos(total - compareTotal),
    deltaPct: percentChange(total, compareTotal),
    byCategory: sharesOf(inPeriod, total),
    days: daysOf(inPeriod),
  };
}

/** Money in less money out. The margin is null when nothing came in. */
export function profitOf(collected: number, spent: number): { profit: number; marginPct: number | null } {
  const profit = roundCentavos(collected - spent);
  return { profit, marginPct: collected > 0 ? Math.round((profit / collected) * 100) : null };
}

export interface ExpenseDraft {
  amountText: string;
  category: ExpenseCategory;
  spentOn: string;
  paidFrom: ExpensePaidFrom;
  note: string;
}

export type DraftCheck = { ok: true; value: ExpenseInput } | { ok: false; error: string };

export function parsePesos(input: string): number | null {
  const cleaned = input.replace(/[₱,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

/** Checks the sheet before it saves, in words the owner can act on. */
export function validateExpenseDraft(draft: ExpenseDraft, today: string): DraftCheck {
  const amount = parsePesos(draft.amountText);
  if (amount === null || amount <= 0) return { ok: false, error: 'Type how much you spent, like 350.' };
  if (amount > MAX_EXPENSE) return { ok: false, error: 'That is more than one expense can be. Check the amount.' };
  if (!isExpenseCategory(draft.category)) return { ok: false, error: 'Pick what the money was for.' };
  if (!isExpensePaidFrom(draft.paidFrom)) return { ok: false, error: 'Pick how you paid.' };
  if (!Number.isFinite(dateKeyToTime(draft.spentOn))) return { ok: false, error: 'Pick the day you paid.' };
  if (draft.spentOn > today) return { ok: false, error: 'That date has not happened yet.' };

  const note = draft.note.trim();
  if (note.length > MAX_NOTE) return { ok: false, error: `Keep the note under ${MAX_NOTE} letters.` };
  if (draft.category === 'other' && note.length === 0) {
    return { ok: false, error: 'Add a short note so you know what "Other" was.' };
  }

  return {
    ok: true,
    value: {
      amount: roundCentavos(amount),
      category: draft.category,
      spent_on: draft.spentOn,
      paid_from: draft.paidFrom,
      note,
    },
  };
}
