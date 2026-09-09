import { computeDailyMoney, type AnalyticsOrder } from '../daily-analytics';

const NOW = new Date('2026-08-25T14:00:00');

function order(overrides: Partial<AnalyticsOrder>): AnalyticsOrder {
  return {
    status: 'received',
    payment_status: 'unpaid',
    estimated_total: 100,
    final_total: null,
    paid_at: null,
    created_at: '2026-08-25T09:00:00',
    ...overrides,
  };
}

describe('daily money analytics', () => {
  it('returns zeros for an empty day', () => {
    expect(computeDailyMoney([], NOW)).toEqual({
      collectedToday: 0,
      projectedToday: 0,
      receivables: 0,
      ordersToday: 0,
      paymentsToday: 0,
    });
  });

  it("counts today's payments separately from today's orders", () => {
    // The screen shows both numbers. Without this count, an order created
    // yesterday and paid today reads as "money collected, 0 orders" — a money
    // screen contradicting itself.
    const result = computeDailyMoney(
      [
        order({
          payment_status: 'paid',
          paid_at: '2026-08-25T10:00:00',
          created_at: '2026-08-24T18:00:00',
          estimated_total: 2841,
        }),
      ],
      NOW
    );
    expect(result.paymentsToday).toBe(1);
    expect(result.ordersToday).toBe(0);
  });

  it('does not count a cancelled order as a payment received today', () => {
    const result = computeDailyMoney(
      [
        order({ status: 'cancelled', payment_status: 'paid', paid_at: '2026-08-25T10:00:00' }),
        order({ payment_status: 'paid', paid_at: '2026-08-25T11:00:00' }),
      ],
      NOW
    );
    expect(result.paymentsToday).toBe(1);
  });

  it('counts money collected today from orders paid today', () => {
    const result = computeDailyMoney(
      [
        order({ payment_status: 'paid', paid_at: '2026-08-25T10:00:00', estimated_total: 150 }),
        order({ payment_status: 'paid', paid_at: '2026-08-24T10:00:00', estimated_total: 999 }),
      ],
      NOW
    );
    expect(result.collectedToday).toBe(150);
  });

  it('prefers final_total over estimated_total when set', () => {
    const result = computeDailyMoney(
      [
        order({
          payment_status: 'paid',
          paid_at: '2026-08-25T10:00:00',
          estimated_total: 100,
          final_total: 120,
        }),
      ],
      NOW
    );
    expect(result.collectedToday).toBe(120);
  });

  it('projects today as collected plus unpaid orders created today', () => {
    const result = computeDailyMoney(
      [
        order({ payment_status: 'paid', paid_at: '2026-08-25T10:00:00', estimated_total: 200 }),
        order({ estimated_total: 300, created_at: '2026-08-25T11:00:00' }),
        // yesterday's unpaid order is a receivable but not part of today's projection
        order({ estimated_total: 400, created_at: '2026-08-24T11:00:00' }),
      ],
      NOW
    );
    expect(result.projectedToday).toBe(500);
  });

  it('sums receivables across all unpaid, non-cancelled orders', () => {
    const result = computeDailyMoney(
      [
        order({ estimated_total: 300, created_at: '2026-08-25T11:00:00' }),
        order({ estimated_total: 400, created_at: '2026-08-01T11:00:00' }),
        order({ estimated_total: 999, status: 'cancelled' }),
        order({ payment_status: 'paid', paid_at: '2026-08-25T10:00:00', estimated_total: 100 }),
      ],
      NOW
    );
    expect(result.receivables).toBe(700);
  });

  it('counts orders created today excluding cancelled ones', () => {
    const result = computeDailyMoney(
      [
        order({}),
        order({ created_at: '2026-08-25T13:59:00' }),
        order({ status: 'cancelled' }),
        order({ created_at: '2026-08-24T09:00:00' }),
      ],
      NOW
    );
    expect(result.ordersToday).toBe(2);
  });

  it('excludes cancelled orders from collected money even if they were paid', () => {
    const result = computeDailyMoney(
      [
        order({ payment_status: 'paid', paid_at: '2026-08-25T10:00:00', estimated_total: 150 }),
        order({
          status: 'cancelled',
          payment_status: 'paid',
          paid_at: '2026-08-25T11:00:00',
          estimated_total: 999,
        }),
      ],
      NOW
    );
    expect(result.collectedToday).toBe(150);
    expect(result.projectedToday).toBe(150);
  });

  it('rounds money to two decimals', () => {
    const result = computeDailyMoney(
      [
        order({ payment_status: 'paid', paid_at: '2026-08-25T10:00:00', estimated_total: 10.105 }),
        order({ payment_status: 'paid', paid_at: '2026-08-25T10:30:00', estimated_total: 20.105 }),
      ],
      NOW
    );
    expect(result.collectedToday).toBe(30.21);
  });
});
