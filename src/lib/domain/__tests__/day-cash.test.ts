import { dayCash, type DayCashOrder } from '../day-cash';
import { frameFor } from '../sales-period';

// Monday 28 Sep 2026, 2:15 PM local.
const NOW = new Date(2026, 8, 28, 14, 15);
const iso = (d: number, h: number, min = 0) => new Date(2026, 8, d, h, min).toISOString();
const today = frameFor({ kind: 'day', offset: 0 }, NOW);
const yesterday = frameFor({ kind: 'day', offset: -1 }, NOW);

let seq = 0;
function order(overrides: Partial<DayCashOrder> = {}): DayCashOrder {
  seq += 1;
  return {
    id: `o${seq}`,
    status: 'completed',
    payment_status: 'paid',
    estimated_total: 100,
    final_total: null,
    paid_at: iso(28, 10),
    created_at: iso(28, 9),
    ...overrides,
  };
}

describe('dayCash', () => {
  it('counts money paid today as cash in, whenever the order was taken', () => {
    const orders = [
      order({ final_total: 250 }),
      // Dropped off last week, picked up and paid this morning.
      order({ created_at: iso(21, 9), paid_at: iso(28, 11), estimated_total: 180 }),
    ];

    const cash = dayCash(orders, today);

    expect(cash.cashIn).toBe(430);
    expect(cash.paidCount).toBe(2);
  });

  it("keeps today's unpaid orders out of cash in and in to collect", () => {
    const orders = [
      order({ estimated_total: 200 }),
      order({ payment_status: 'unpaid', paid_at: null, estimated_total: 150 }),
      order({ payment_status: 'unpaid', paid_at: null, final_total: 90 }),
    ];

    const cash = dayCash(orders, today);

    expect(cash.cashIn).toBe(200);
    expect(cash.toCollect).toBe(240);
    expect(cash.unpaidCount).toBe(2);
  });

  it("leaves other days' unpaid orders out of today's to collect", () => {
    const orders = [order({ created_at: iso(25, 9), payment_status: 'unpaid', paid_at: null })];

    expect(dayCash(orders, today).toCollect).toBe(0);
  });

  it('ignores cancelled orders and payments not yet made', () => {
    const orders = [
      order({ status: 'cancelled' }),
      order({ status: 'cancelled', payment_status: 'unpaid', paid_at: null }),
      // Stamped later in the day than the clock reads: not in yet.
      order({ paid_at: iso(28, 18) }),
    ];

    const cash = dayCash(orders, today);

    expect(cash.cashIn).toBe(0);
    expect(cash.toCollect).toBe(0);
  });

  it('reads a past day on its own: its payments, its still-unpaid orders', () => {
    const orders = [
      order({ created_at: iso(27, 9), paid_at: iso(27, 17), estimated_total: 300 }),
      order({ created_at: iso(27, 10), paid_at: iso(28, 10), estimated_total: 120 }),
      order({ created_at: iso(27, 11), payment_status: 'unpaid', paid_at: null, estimated_total: 75 }),
    ];

    const cash = dayCash(orders, yesterday);

    expect(cash.cashIn).toBe(300);
    expect(cash.paidCount).toBe(1);
    // Paid this morning, so no longer owed; only the third is still out.
    expect(cash.toCollect).toBe(75);
    expect(cash.unpaidCount).toBe(1);
  });
});
