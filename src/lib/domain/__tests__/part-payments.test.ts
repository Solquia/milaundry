import { dayCash, type DayCashOrder } from '../day-cash';
import { balanceOf, moneyIn, paidInParts } from '../part-payments';
import { computeSales, type SalesOrder } from '../sales-metrics';
import { frameFor } from '../sales-period';

// Monday 28 Sep 2026, 2:15 PM local.
const NOW = new Date(2026, 8, 28, 14, 15);
const iso = (d: number, h: number, min = 0) => new Date(2026, 8, d, h, min).toISOString();
const today = frameFor({ kind: 'day', offset: 0 }, NOW);
const yesterday = frameFor({ kind: 'day', offset: -1 }, NOW);

// The case from the shop: a ₱165 bill, ₱100 down yesterday, ₱65 left.
function partPaid(overrides: Partial<SalesOrder> = {}): SalesOrder {
  return {
    id: 'o1',
    status: 'ready',
    payment_status: 'unpaid',
    payment_method: 'cash',
    order_type: 'walk_in',
    estimated_total: 165,
    final_total: 165,
    paid_at: null,
    part_payments: [{ amount: 100, at: iso(27, 11), method: 'cash' }],
    created_at: iso(27, 10),
    actual_weight_kg: null,
    customer_name: 'Aling Nena',
    customer_phone: '09171234567',
    customer_id: null,
    order_items: [],
    ...overrides,
  };
}

const settled = (): SalesOrder =>
  partPaid({ payment_status: 'paid', paid_at: iso(28, 9), payment_method: 'gcash' });

describe('part payments', () => {
  it('leaves the bill less the part to collect', () => {
    expect(paidInParts(partPaid())).toBe(100);
    expect(balanceOf(partPaid())).toBe(65);
    expect(balanceOf(settled())).toBe(0);
  });

  it('splits a settled order into the part and the rest, each on its own day', () => {
    expect(moneyIn(settled())).toEqual([
      { amount: 100, at: iso(27, 11), method: 'cash', isPart: true },
      { amount: 65, at: iso(28, 9), method: 'gcash', isPart: false },
    ]);
  });

  it('is one payment for an order paid in one go', () => {
    expect(moneyIn(partPaid({ part_payments: [], payment_status: 'paid', paid_at: iso(28, 9) }))).toEqual([
      { amount: 165, at: iso(28, 9), method: 'cash', isPart: false },
    ]);
  });

  it('counts the part in the day it was handed over and only the balance as owed', () => {
    const orders: DayCashOrder[] = [partPaid()];
    expect(dayCash(orders, yesterday)).toEqual({ cashIn: 100, paidCount: 1, toCollect: 65, unpaidCount: 1 });
    expect(dayCash(orders, today).cashIn).toBe(0);
  });

  it('counts only the rest on the day it is settled', () => {
    expect(dayCash([settled()], today)).toMatchObject({ cashIn: 65, paidCount: 1 });
    expect(dayCash([settled()], yesterday)).toMatchObject({ cashIn: 100, toCollect: 0 });
  });

  it('shows the part as a sale and a payment on the Sales screen', () => {
    const sales = computeSales([partPaid()], yesterday);
    expect(sales.metrics.sales.total).toBe(100);
    expect(sales.payments).toEqual([
      expect.objectContaining({ orderId: 'o1', isPart: true, amount: 100, method: 'cash' }),
    ]);
  });

  it('keeps today and yesterday apart once the rest comes in', () => {
    const sales = computeSales([settled()], today);
    expect(sales.metrics.sales.total).toBe(65);
    expect(sales.metrics.sales.compareTotal).toBe(100);
    expect(sales.payments.map((payment) => payment.id)).toEqual(['o1']);
  });
});
