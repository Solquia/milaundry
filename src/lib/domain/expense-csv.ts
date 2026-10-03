/**
 * The period's expenses as a CSV a bookkeeper (or the BIR books) can open in
 * Excel or Google Sheets: one row per expense, oldest first, and a total row
 * so the file checks against the screen.
 *
 * A note is owner-typed text, so a cell that starts like a formula is
 * prefixed with an apostrophe: a spreadsheet would otherwise run `=…` from a
 * file the owner trusts.
 */
import { CATEGORY_LOOKS, PAID_FROM_LABELS } from './expense-categories';
import type { Expense } from './expense-metrics';
import { roundCentavos } from './money';

const HEADER = ['Date', 'Category', 'Amount', 'Paid with', 'Note'];
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: string): string {
  const safe = FORMULA_START.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function expensesToCsv(expenses: readonly Expense[]): string {
  const sorted = [...expenses].sort((a, b) =>
    a.spent_on === b.spent_on ? (a.created_at < b.created_at ? -1 : 1) : a.spent_on < b.spent_on ? -1 : 1
  );
  const total = roundCentavos(sorted.reduce((sum, item) => sum + item.amount, 0));
  const rows = sorted.map((item) =>
    [
      item.spent_on,
      CATEGORY_LOOKS[item.category].label,
      item.amount.toFixed(2),
      PAID_FROM_LABELS[item.paid_from],
      item.note,
    ].map(cell)
  );
  return [HEADER, ...rows, ['Total', '', total.toFixed(2), '', '']].map((row) => row.join(',')).join('\r\n');
}

const slug = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** `sparkle-clean-expenses-september-2026.csv` */
export function expenseCsvFilename(shopName: string, periodCaption: string): string {
  return `${[slug(shopName), 'expenses', slug(periodCaption)].filter(Boolean).join('-')}.csv`;
}
