import {
  dateKeyToTime,
  dayLabel,
  expenseRange,
  profitOf,
  shiftDateKey,
  summarizeExpenses,
  toDateKey,
  validateExpenseDraft,
  type Expense,
} from '../expense-metrics';
import { frameFor } from '../sales-period';

// Wednesday 30 Sep 2026, 2:15 PM local.
const NOW = new Date(2026, 8, 30, 14, 15);
const THIS_MONTH = frameFor({ kind: 'month', offset: 0 }, NOW);
const LAST_MONTH = frameFor({ kind: 'month', offset: -1 }, NOW);

let seq = 0;
const expense = (spent_on: string, amount: number, category: Expense['category'] = 'supplies'): Expense => ({
  id: `e${++seq}`,
  shop_id: 'shop-1',
  spent_on,
  amount,
  category,
  note: '',
  paid_from: 'cash',
  created_at: `${spent_on}T08:00:00Z`,
  recurring_id: null,
  receipt_path: null,
});

describe('calendar dates', () => {
  it('writes a local date as YYYY-MM-DD and reads it back as local midnight', () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dateKeyToTime('2026-01-05')).toBe(new Date(2026, 0, 5).getTime());
  });

  it('refuses a date that is not a real day', () => {
    expect(dateKeyToTime('2026-02-30')).toBeNaN();
    expect(dateKeyToTime('yesterday')).toBeNaN();
  });

  it('steps a date across a month end', () => {
    expect(shiftDateKey('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('names today and yesterday, and dates the rest', () => {
    expect(dayLabel('2026-09-30', '2026-09-30')).toBe('Today');
    expect(dayLabel('2026-09-29', '2026-09-30')).toBe('Yesterday');
    expect(dayLabel('2026-09-28', '2026-09-30')).toBe('Mon 28 Sep');
  });
});

describe('the rows a period needs', () => {
  it('fetches from the start of the comparison period up to the end of this one', () => {
    expect(expenseRange(THIS_MONTH)).toEqual({ from: '2026-08-01', to: '2026-10-01' });
  });
});

describe('what the shop spent in a period', () => {
  it('adds up the month and leaves other months out', () => {
    const summary = summarizeExpenses(
      [expense('2026-09-01', 350), expense('2026-09-30', 8000, 'rent'), expense('2026-10-01', 99)],
      THIS_MONTH
    );
    expect(summary.total).toBe(8350);
    expect(summary.count).toBe(2);
  });

  it('compares a live month with last month up to the same day', () => {
    const summary = summarizeExpenses(
      [expense('2026-08-10', 1000), expense('2026-08-31', 5000), expense('2026-09-05', 1500)],
      THIS_MONTH
    );
    expect(summary.compareTotal).toBe(1000);
    expect(summary.delta).toBe(500);
    expect(summary.deltaPct).toBe(50);
  });

  it('compares a finished month with the whole month before it', () => {
    const summary = summarizeExpenses(
      [expense('2026-07-31', 400), expense('2026-08-31', 600)],
      LAST_MONTH
    );
    expect(summary.total).toBe(600);
    expect(summary.compareTotal).toBe(400);
  });

  it('breaks the month down by category, biggest first, with whole-percent shares', () => {
    const summary = summarizeExpenses(
      [
        expense('2026-09-02', 300, 'supplies'),
        expense('2026-09-03', 600, 'rent'),
        expense('2026-09-04', 100, 'supplies'),
      ],
      THIS_MONTH
    );
    expect(summary.byCategory).toEqual([
      { key: 'rent', label: 'Rent', amount: 600, share: 60 },
      { key: 'supplies', label: 'Supplies', amount: 400, share: 40 },
    ]);
  });

  it('lists the days newest first, each with its own total', () => {
    const summary = summarizeExpenses(
      [expense('2026-09-01', 10), expense('2026-09-12', 20), expense('2026-09-12', 5)],
      THIS_MONTH
    );
    expect(summary.days.map((day) => [day.date, day.total, day.items.length])).toEqual([
      ['2026-09-12', 25, 2],
      ['2026-09-01', 10, 1],
    ]);
  });

  it('does not drift a centavo when adding many small amounts', () => {
    const summary = summarizeExpenses(
      Array.from({ length: 10 }, () => expense('2026-09-09', 0.1)),
      THIS_MONTH
    );
    expect(summary.total).toBe(1);
  });

  it('reads an empty month as zero with nothing to compare', () => {
    const summary = summarizeExpenses([], THIS_MONTH);
    expect(summary.total).toBe(0);
    expect(summary.deltaPct).toBeNull();
    expect(summary.byCategory).toEqual([]);
  });
});

describe('profit', () => {
  it('is what came in less what went out, with the margin in whole percent', () => {
    expect(profitOf(20000, 5000)).toEqual({ profit: 15000, marginPct: 75 });
  });

  it('can be a loss', () => {
    expect(profitOf(1000, 1500)).toEqual({ profit: -500, marginPct: -50 });
  });

  it('has no margin when nothing came in', () => {
    expect(profitOf(0, 300)).toEqual({ profit: -300, marginPct: null });
  });
});

describe('checking what the owner typed', () => {
  const draft = {
    amountText: '₱1,250.50',
    category: 'utilities' as const,
    spentOn: '2026-09-30',
    paidFrom: 'gcash' as const,
    note: '  Meralco  ',
  };

  it('accepts a normal expense and tidies it', () => {
    expect(validateExpenseDraft(draft, '2026-09-30')).toEqual({
      ok: true,
      value: {
        amount: 1250.5,
        category: 'utilities',
        spent_on: '2026-09-30',
        paid_from: 'gcash',
        note: 'Meralco',
      },
    });
  });

  it('asks for an amount above zero', () => {
    expect(validateExpenseDraft({ ...draft, amountText: '' }, '2026-09-30')).toEqual({
      ok: false,
      error: 'Type how much you spent, like 350.',
    });
    expect(validateExpenseDraft({ ...draft, amountText: '0' }, '2026-09-30').ok).toBe(false);
  });

  it('refuses an amount too big to be one expense', () => {
    expect(validateExpenseDraft({ ...draft, amountText: '1000001' }, '2026-09-30').ok).toBe(false);
  });

  it('refuses a date in the future', () => {
    expect(validateExpenseDraft({ ...draft, spentOn: '2026-10-01' }, '2026-09-30')).toEqual({
      ok: false,
      error: 'That date has not happened yet.',
    });
  });

  it('wants a note when the category is Other', () => {
    expect(validateExpenseDraft({ ...draft, category: 'other', note: ' ' }, '2026-09-30')).toEqual({
      ok: false,
      error: 'Add a short note so you know what "Other" was.',
    });
  });

  it('keeps notes short', () => {
    expect(validateExpenseDraft({ ...draft, note: 'x'.repeat(201) }, '2026-09-30').ok).toBe(false);
  });
});
