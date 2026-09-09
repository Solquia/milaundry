import { computeEarnings, describeChange, type EarningsOrder } from '../earnings-summary';

const NOW = new Date('2026-09-06T14:30:00');

function order(overrides: Partial<EarningsOrder>): EarningsOrder {
  return {
    status: 'completed',
    payment_status: 'paid',
    estimated_total: 100,
    final_total: null,
    paid_at: '2026-09-06T10:00:00',
    created_at: '2026-09-06T09:00:00',
    order_type: 'walk_in',
    payment_method: 'cash',
    order_items: [{ service_name: 'Wash & Fold', subtotal: 100 }],
    ...overrides,
  };
}

describe('earnings over a window', () => {
  it('is all zeros with nothing to count', () => {
    const summary = computeEarnings([], 'today', NOW);
    expect(summary.collected).toBe(0);
    expect(summary.paymentsCount).toBe(0);
    expect(summary.ordersTaken).toBe(0);
    expect(summary.averageOrder).toBe(0);
    expect(summary.receivables).toBe(0);
    expect(summary.changePct).toBeNull();
    expect(summary.topServices).toEqual([]);
  });

  it('collects money by when it was paid, not when the order was taken', () => {
    const summary = computeEarnings(
      [
        order({ paid_at: '2026-09-06T10:00:00', created_at: '2026-09-01T09:00:00' }),
        order({ paid_at: '2026-09-01T10:00:00', created_at: '2026-09-06T09:00:00' }),
      ],
      'today',
      NOW
    );
    expect(summary.collected).toBe(100);
    expect(summary.paymentsCount).toBe(1);
    expect(summary.ordersTaken).toBe(1);
  });

  it('never counts a cancelled order as money in', () => {
    const summary = computeEarnings([order({ status: 'cancelled' })], 'today', NOW);
    expect(summary.collected).toBe(0);
    expect(summary.ordersTaken).toBe(0);
  });

  it('prefers the weighed total over the estimate', () => {
    const summary = computeEarnings([order({ final_total: 140 })], 'today', NOW);
    expect(summary.collected).toBe(140);
  });

  it('averages the value of orders taken in the window, paid or not', () => {
    const summary = computeEarnings(
      [
        order({ estimated_total: 100 }),
        order({ estimated_total: 300, payment_status: 'unpaid', paid_at: null }),
      ],
      'today',
      NOW
    );
    expect(summary.averageOrder).toBe(200);
  });

  it('receivables are every unpaid order regardless of the window', () => {
    const summary = computeEarnings(
      [
        order({ payment_status: 'unpaid', paid_at: null, created_at: '2026-01-01T09:00:00' }),
        order({ payment_status: 'unpaid', paid_at: null, estimated_total: 50 }),
        order({ payment_status: 'unpaid', paid_at: null, status: 'cancelled' }),
      ],
      'today',
      NOW
    );
    expect(summary.receivables).toBe(150);
    expect(summary.unpaidCount).toBe(2);
  });

  it('compares against the previous window of the same length', () => {
    const summary = computeEarnings(
      [
        order({ paid_at: '2026-09-06T10:00:00', estimated_total: 150 }),
        order({ paid_at: '2026-09-05T10:00:00', estimated_total: 100 }),
      ],
      'today',
      NOW
    );
    expect(summary.previousCollected).toBe(100);
    expect(summary.changePct).toBe(50);
  });

  it('has no change figure when the previous window was empty or does not exist', () => {
    const today = computeEarnings([order({})], 'today', NOW);
    expect(today.previousCollected).toBe(0);
    expect(today.changePct).toBeNull();

    const all = computeEarnings([order({})], 'all', NOW);
    expect(all.previousCollected).toBeNull();
    expect(all.changePct).toBeNull();
  });

  it('fills a trend bar for each bucket in the window', () => {
    const summary = computeEarnings(
      [
        order({ paid_at: '2026-09-06T10:00:00', estimated_total: 40 }),
        order({ paid_at: '2026-09-06T12:00:00', estimated_total: 60 }),
        order({ paid_at: '2026-09-04T12:00:00', estimated_total: 25 }),
      ],
      '7d',
      NOW
    );
    expect(summary.trend).toHaveLength(7);
    expect(summary.trend[6].amount).toBe(100);
    expect(summary.trend[4].amount).toBe(25);
    expect(summary.trend[0].amount).toBe(0);
    expect(summary.trendPeak).toBe(100);
  });

  it('splits collected money by where the order came from', () => {
    const summary = computeEarnings(
      [
        order({ order_type: 'walk_in', estimated_total: 70 }),
        order({ order_type: 'online', estimated_total: 30 }),
      ],
      'today',
      NOW
    );
    expect(summary.sources).toEqual([
      { key: 'walk_in', label: 'Walk-in', amount: 70, share: 70 },
      { key: 'online', label: 'Online', amount: 30, share: 30 },
    ]);
  });

  it('lists payment methods by money taken, largest first, dropping unused ones', () => {
    const summary = computeEarnings(
      [
        order({ payment_method: 'cash', estimated_total: 30 }),
        order({ payment_method: 'gcash', estimated_total: 70 }),
      ],
      'today',
      NOW
    );
    expect(summary.methods.map((m) => m.key)).toEqual(['gcash', 'cash']);
    expect(summary.methods[0].share).toBe(70);
  });

  it('ranks services by revenue across the orders taken in the window', () => {
    const summary = computeEarnings(
      [
        order({
          order_items: [
            { service_name: 'Wash & Fold', subtotal: 100 },
            { service_name: 'Comforter', subtotal: 250 },
          ],
        }),
        order({ order_items: [{ service_name: 'Wash & Fold', subtotal: 120 }] }),
        order({
          status: 'cancelled',
          order_items: [{ service_name: 'Dry clean', subtotal: 999 }],
        }),
      ],
      'today',
      NOW
    );
    expect(summary.topServices).toEqual([
      { name: 'Comforter', revenue: 250, count: 1, share: 53 },
      { name: 'Wash & Fold', revenue: 220, count: 2, share: 47 },
    ]);
  });

  it('caps the service list at five', () => {
    const items = Array.from({ length: 8 }, (_, i) => ({
      service_name: `Service ${i}`,
      subtotal: 10 * (i + 1),
    }));
    const summary = computeEarnings([order({ order_items: items })], 'today', NOW);
    expect(summary.topServices).toHaveLength(5);
    expect(summary.topServices[0].name).toBe('Service 7');
  });
});

describe('describing the change', () => {
  it('reads as a comparison with the previous window', () => {
    expect(describeChange(50, 'today')).toEqual({ text: '+50% vs yesterday', tone: 'up' });
    expect(describeChange(-12, '7d')).toEqual({
      text: '−12% vs previous 7 days',
      tone: 'down',
    });
    expect(describeChange(0, '30d')).toEqual({ text: 'Same as previous 30 days', tone: 'flat' });
  });

  it('says nothing when there is nothing to compare', () => {
    expect(describeChange(null, 'all')).toBeNull();
  });
});
