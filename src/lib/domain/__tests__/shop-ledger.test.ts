import { frameFor } from '../sales-period';
import type { PeriodOrderCost } from '../service-costs';
import { shopLedger, type LedgerOrder } from '../shop-ledger';

// Monday 28 Sep 2026, 2:15 PM local.
const NOW = new Date(2026, 8, 28, 14, 15);
const iso = (d: number, h: number, min = 0) => new Date(2026, 8, d, h, min).toISOString();
const today = frameFor({ kind: 'day', offset: 0 }, NOW);

let seq = 0;
function order(overrides: Partial<LedgerOrder> = {}): LedgerOrder {
  seq += 1;
  return {
    id: `o${seq}`,
    status: 'completed',
    payment_status: 'paid',
    order_type: 'walk_in',
    estimated_total: 150,
    final_total: null,
    paid_at: iso(28, 10),
    created_at: iso(28, 9),
    customer_name: 'Aling Nena',
    customer_phone: '09171234567',
    customer_id: null,
    ...overrides,
  };
}

const cost = (
  orderId: string,
  value: number | null,
  extra: Partial<PeriodOrderCost> = {}
): PeriodOrderCost => ({
  orderId,
  cost: value,
  lines: 1,
  costedLines: value === null ? 0 : 1,
  takenBy: 'Merz',
  ...extra,
});

describe('shopLedger', () => {
  it('lists the orders taken in the period, newest first, with supplies and profit', () => {
    const a = order({ created_at: iso(28, 8) });
    const b = order({ created_at: iso(28, 11), payment_status: 'unpaid', paid_at: null, final_total: 200 });

    const ledger = shopLedger([a, b], [cost(a.id, 9.32), cost(b.id, 25)], today);

    expect(ledger.rows.map((row) => row.id)).toEqual([b.id, a.id]);
    expect(ledger.rows[1]).toMatchObject({ total: 150, supplies: 9.32, profit: 140.68, isPaid: true, takenBy: 'Merz' });
    expect(ledger.rows[0]).toMatchObject({ total: 200, isPaid: false });
  });

  it('totals the period: sold, cash in, still unpaid, supplies used', () => {
    const a = order();
    const b = order({ payment_status: 'unpaid', paid_at: null, final_total: 200 });
    // Taken last week, paid today: cash today, but not an order taken today.
    const c = order({ created_at: iso(21, 9), estimated_total: 90 });

    const { totals } = shopLedger([a, b, c], [cost(a.id, 10), cost(b.id, 20)], today);

    expect(totals).toMatchObject({
      taken: 2,
      sold: 350,
      cashIn: 240,
      toCollect: 200,
      supplies: 30,
      profit: 320,
      uncosted: 0,
    });
  });

  it('leaves cancelled orders out and counts orders with no cost set', () => {
    const a = order({ status: 'cancelled' });
    const b = order();
    const c = order({ created_at: iso(28, 12) });

    const ledger = shopLedger(
      [a, b, c],
      [cost(a.id, 50), cost(b.id, null), cost(c.id, 5, { lines: 2, costedLines: 1 })],
      today
    );

    expect(ledger.rows).toHaveLength(2);
    expect(ledger.totals.supplies).toBe(5);
    expect(ledger.totals.uncosted).toBe(2);
    expect(ledger.rows.find((row) => row.id === b.id)).toMatchObject({ supplies: null, profit: null });
  });

  it('still lists orders while their costs are loading', () => {
    const ledger = shopLedger([order()], undefined, today);

    expect(ledger.rows[0]).toMatchObject({ supplies: null, takenBy: null });
    expect(ledger.totals.supplies).toBe(0);
  });
});
