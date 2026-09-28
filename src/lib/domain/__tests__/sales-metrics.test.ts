import { frameFor } from '../sales-period';
import { computeSales, type SalesOrder } from '../sales-metrics';

// Monday 28 Sep 2026, 2:15 PM local.
const NOW = new Date(2026, 8, 28, 14, 15);
const iso = (d: number, h: number, min = 0) => new Date(2026, 8, d, h, min).toISOString();
const today = frameFor({ kind: 'day', offset: 0 }, NOW);

let seq = 0;
function order(overrides: Partial<SalesOrder> = {}): SalesOrder {
  seq += 1;
  return {
    id: `o${seq}`,
    status: 'completed',
    payment_status: 'paid',
    payment_method: 'cash',
    order_type: 'walk_in',
    estimated_total: 100,
    final_total: null,
    paid_at: iso(28, 10),
    created_at: iso(28, 9),
    actual_weight_kg: null,
    customer_name: 'Aling Nena',
    customer_phone: '09171234567',
    customer_id: null,
    order_items: [{ service_name: 'Wash-Dry-Fold', unit: 'per_kg', quantity: 5, subtotal: 100 }],
    ...overrides,
  };
}

describe('sales over a period', () => {
  it('is all zeros with nothing to count', () => {
    const sales = computeSales([], today);
    expect(sales.metrics.sales.total).toBe(0);
    expect(sales.metrics.orders.total).toBe(0);
    expect(sales.metrics.basket.total).toBe(0);
    expect(sales.metrics.sales.deltaPct).toBeNull();
    expect(sales.payments).toEqual([]);
    expect(sales.bestsellers).toEqual([]);
  });

  it('counts money on the day it was paid and orders on the day they were taken', () => {
    const sales = computeSales(
      [order({ created_at: iso(25, 9), paid_at: iso(28, 11), final_total: 240 })],
      today
    );
    expect(sales.metrics.sales.total).toBe(240);
    expect(sales.metrics.orders.total).toBe(0);
  });

  it('ignores cancelled orders entirely', () => {
    const sales = computeSales([order({ status: 'cancelled' })], today);
    expect(sales.metrics.sales.total).toBe(0);
    expect(sales.metrics.orders.total).toBe(0);
  });

  it('compares today with yesterday up to the same minute, not all of yesterday', () => {
    const sales = computeSales(
      [
        order({ paid_at: iso(28, 10), estimated_total: 300 }),
        order({ paid_at: iso(27, 11), created_at: iso(27, 9), estimated_total: 200 }),
        // Yesterday evening: after 2:15 PM, so not part of the pace.
        order({ paid_at: iso(27, 19), created_at: iso(27, 18), estimated_total: 900 }),
      ],
      today
    );
    expect(sales.metrics.sales.total).toBe(300);
    expect(sales.metrics.sales.compareTotal).toBe(200);
    expect(sales.metrics.sales.delta).toBe(100);
    expect(sales.metrics.sales.deltaPct).toBe(50);
  });

  it('still draws the rest of yesterday as the ghost for the hours to come', () => {
    const sales = computeSales(
      [order({ paid_at: iso(27, 19), created_at: iso(27, 18), estimated_total: 900 })],
      today
    );
    expect(sales.metrics.sales.compareSeries[19]).toBe(900);
    expect(sales.metrics.sales.series[19]).toBe(0);
  });

  it('puts each payment in the hour it arrived', () => {
    const sales = computeSales([order({ paid_at: iso(28, 10, 40), estimated_total: 150 })], today);
    expect(sales.metrics.sales.series[10]).toBe(150);
  });

  it('weighs a load by the scale when it was weighed, else by the kilos on the ticket', () => {
    const sales = computeSales(
      [
        order({ actual_weight_kg: 6.5 }),
        order({
          order_items: [
            { service_name: 'Wash-Dry-Fold', unit: 'per_kg', quantity: 4, subtotal: 80 },
            { service_name: 'Comforter', unit: 'per_item', quantity: 1, subtotal: 150 },
          ],
        }),
      ],
      today
    );
    expect(sales.metrics.kilos.total).toBe(10.5);
  });

  it('averages the basket over the orders taken', () => {
    const sales = computeSales(
      [order({ estimated_total: 100 }), order({ estimated_total: 300, payment_status: 'unpaid', paid_at: null })],
      today
    );
    expect(sales.metrics.basket.total).toBe(200);
    expect(sales.metrics.orders.total).toBe(2);
  });

  it('lists the payments behind the figure, newest first', () => {
    const sales = computeSales(
      [
        order({ id: 'a', paid_at: iso(28, 9), payment_method: 'gcash' }),
        order({ id: 'b', paid_at: iso(28, 13) }),
      ],
      today
    );
    expect(sales.payments.map((payment) => payment.id)).toEqual(['b', 'a']);
    expect(sales.payments[1]).toMatchObject({ method: 'gcash', name: 'Aling Nena', amount: 100 });
  });

  it('splits the money by how it was paid, biggest first', () => {
    const sales = computeSales(
      [
        order({ payment_method: 'gcash', estimated_total: 500 }),
        order({ payment_method: 'cash', estimated_total: 200 }),
      ],
      today
    );
    expect(sales.methods.map((row) => [row.key, row.amount])).toEqual([
      ['gcash', 500],
      ['cash', 200],
    ]);
  });

  it('ranks bestsellers by revenue with their units and change', () => {
    const sales = computeSales(
      [
        order({
          order_items: [
            { service_name: 'Wash-Dry-Fold', unit: 'per_kg', quantity: 6, subtotal: 180 },
            { service_name: 'Dry clean', unit: 'per_item', quantity: 3, subtotal: 450 },
          ],
        }),
        order({
          created_at: iso(27, 9),
          paid_at: iso(27, 10),
          order_items: [{ service_name: 'Dry clean', unit: 'per_item', quantity: 2, subtotal: 300 }],
        }),
      ],
      today
    );
    expect(sales.bestsellers.map((row) => row.name)).toEqual(['Dry clean', 'Wash-Dry-Fold']);
    expect(sales.bestsellers[0]).toMatchObject({ quantity: 3, unit: 'per_item', revenue: 450, deltaPct: 50 });
    expect(sales.bestsellers[1].deltaPct).toBeNull();
  });
});
