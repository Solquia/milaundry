import { expenseCsvFilename, expensesToCsv } from '../expense-csv';
import {
  dueBills,
  dueDateFor,
  ordinalDay,
  validateRecurringDraft,
  type RecurringExpense,
} from '../expense-recurring';
import type { Expense } from '../expense-metrics';

const bill = (overrides: Partial<RecurringExpense> = {}): RecurringExpense => ({
  id: 'rent',
  shop_id: 'shop-1',
  amount: 8000,
  category: 'rent',
  note: 'Stall rent',
  paid_from: 'bank',
  day_of_month: 5,
  is_active: true,
  ...overrides,
});

const logged = (recurring_id: string | null, spent_on: string): Expense => ({
  id: `x-${spent_on}`,
  shop_id: 'shop-1',
  spent_on,
  amount: 8000,
  category: 'rent',
  note: '',
  paid_from: 'bank',
  created_at: `${spent_on}T09:00:00Z`,
  recurring_id,
  receipt_path: null,
});

describe('when a recurring bill falls due', () => {
  it('falls on its day of this month', () => {
    expect(dueDateFor(bill(), '2026-10-03')).toBe('2026-10-05');
  });

  it('falls on the last day of a month too short for it', () => {
    expect(dueDateFor(bill({ day_of_month: 31 }), '2026-02-10')).toBe('2026-02-28');
    expect(dueDateFor(bill({ day_of_month: 30 }), '2028-02-01')).toBe('2028-02-29');
  });

  it('reads the day as the 1st, 2nd, 3rd, 21st, 31st', () => {
    expect([1, 2, 3, 4, 11, 12, 21, 22, 31].map(ordinalDay)).toEqual([
      '1st', '2nd', '3rd', '4th', '11th', '12th', '21st', '22nd', '31st',
    ]);
  });
});

describe('which bills to offer', () => {
  it('offers a bill once its day has come and it is not logged this month', () => {
    expect(dueBills([bill()], [], '2026-10-05')).toEqual([{ bill: bill(), dueOn: '2026-10-05' }]);
  });

  it('waits until the day comes', () => {
    expect(dueBills([bill()], [], '2026-10-04')).toEqual([]);
  });

  it('stops offering once this month has been logged', () => {
    expect(dueBills([bill()], [logged('rent', '2026-10-05')], '2026-10-20')).toEqual([]);
  });

  it('still offers when only last month was logged', () => {
    expect(dueBills([bill()], [logged('rent', '2026-09-05')], '2026-10-20')).toHaveLength(1);
  });

  it('ignores a stopped bill', () => {
    expect(dueBills([bill({ is_active: false })], [], '2026-10-20')).toEqual([]);
  });
});

describe('checking a recurring bill', () => {
  const draft = { amountText: '8,000', category: 'rent' as const, paidFrom: 'bank' as const, note: ' Stall ', dayOfMonth: 5 };

  it('accepts and tidies a normal bill', () => {
    expect(validateRecurringDraft(draft)).toEqual({
      ok: true,
      value: { amount: 8000, category: 'rent', paid_from: 'bank', note: 'Stall', day_of_month: 5 },
    });
  });

  it('refuses a day that is not in any month', () => {
    expect(validateRecurringDraft({ ...draft, dayOfMonth: 0 }).ok).toBe(false);
    expect(validateRecurringDraft({ ...draft, dayOfMonth: 32 }).ok).toBe(false);
  });

  it('asks for an amount', () => {
    expect(validateRecurringDraft({ ...draft, amountText: 'abc' })).toEqual({
      ok: false,
      error: 'Type how much the bill is, like 8000.',
    });
  });
});

describe('the CSV for the bookkeeper', () => {
  it('writes one row per expense, oldest first, with a header and a total', () => {
    const csv = expensesToCsv([
      { ...logged(null, '2026-09-12'), note: 'Ariel, 2 gallons', category: 'supplies', amount: 1250.5, paid_from: 'cash' },
      { ...logged(null, '2026-09-01'), note: 'He said "rent"', amount: 8000 },
    ]);
    expect(csv.split('\r\n')).toEqual([
      'Date,Category,Amount,Paid with,Note',
      '2026-09-01,Rent,8000.00,Bank,"He said ""rent"""',
      '2026-09-12,Supplies,1250.50,Cash,"Ariel, 2 gallons"',
      'Total,,9250.50,,',
    ]);
  });

  it('neutralises a note a spreadsheet would run as a formula', () => {
    const csv = expensesToCsv([{ ...logged(null, '2026-09-01'), note: '=1+1' }]);
    expect(csv.split('\r\n')[1]).toBe("2026-09-01,Rent,8000.00,Bank,'=1+1");
  });

  it('names the file after the shop and the dates', () => {
    expect(expenseCsvFilename('Sparkle Clean!', 'September 2026')).toBe('sparkle-clean-expenses-september-2026.csv');
  });
});
