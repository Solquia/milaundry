import type { ServiceRow } from '../../types';
import {
  costPerUnit,
  formatUnitCost,
  orderProfit,
  parseAmount,
  parseSupplyDraft,
  recipeCost,
  serviceProfitLines,
  serviceProfitSummary,
  usageBasis,
  type Supply,
} from '../service-costs';

function service(overrides: Partial<ServiceRow>): ServiceRow {
  return {
    id: 's',
    shop_id: 'shop-1',
    name: 'Wash Dry Fold',
    unit: 'flat',
    price: 180,
    category: 'wash_fold',
    min_quantity: 0,
    max_quantity: 8,
    description: '',
    sort_order: 0,
    is_active: true,
    created_at: '2026-10-01T00:00:00Z',
    ...overrides,
  } as ServiceRow;
}

const bleach: Supply = { id: 'b', shop_id: 'shop-1', name: 'Zonrox', unit: 'ml', pack_size: 1000, pack_cost: 120 };
const fabcon: Supply = { id: 'f', shop_id: 'shop-1', name: 'Downy', unit: 'ml', pack_size: 500, pack_cost: 100 };

describe('costPerUnit', () => {
  test('a bottle of 1000 ml for ₱120 is ₱0.12 a ml', () => {
    expect(costPerUnit(bleach)).toBeCloseTo(0.12);
    expect(formatUnitCost(bleach)).toBe('₱0.12 per ml');
  });

  test('a ml under ten centavos shows finer', () => {
    expect(formatUnitCost({ unit: 'ml', pack_size: 4000, pack_cost: 150 })).toBe('₱0.0375 per ml');
  });
});

describe('usageBasis', () => {
  test('a service washed in loads counts supplies per load', () => {
    expect(usageBasis(service({ unit: 'flat', max_quantity: 8 }))).toBe('load');
    expect(usageBasis(service({ unit: 'per_kg', max_quantity: 8 }))).toBe('load');
  });

  test('otherwise by the unit it is priced in', () => {
    expect(usageBasis(service({ unit: 'per_kg', max_quantity: 0 }))).toBe('kg');
    expect(usageBasis(service({ unit: 'per_item', max_quantity: 0 }))).toBe('piece');
    expect(usageBasis(service({ unit: 'flat', max_quantity: 0 }))).toBe('order');
  });
});

describe('recipeCost', () => {
  test('adds each supply at its price per ml', () => {
    const recipe = [
      { service_id: 's', supply_id: 'b', amount: 50 },
      { service_id: 's', supply_id: 'f', amount: 30 },
      { service_id: 'other', supply_id: 'b', amount: 999 },
    ];
    // 50 × 0.12 + 30 × 0.20
    expect(recipeCost('s', recipe, [bleach, fabcon])).toBe(12);
  });

  test('a service with no supplies has no cost, not zero', () => {
    expect(recipeCost('s', [], [bleach])).toBeNull();
  });
});

describe('serviceProfitLines', () => {
  test('profit per load is the price less the supplies', () => {
    const [line] = serviceProfitLines(
      [service({})],
      [{ service_id: 's', unit_cost: 12, units_recent: 10, revenue_recent: 1800, cost_recent: 120 }]
    );
    expect(line.profitPerUnit).toBe(168);
    expect(line.profitRecent).toBe(1680);
  });

  test('a per-kg service washed in loads has no profit per load, but has one for the month', () => {
    const [line] = serviceProfitLines(
      [service({ unit: 'per_kg', price: 30, max_quantity: 8 })],
      [{ service_id: 's', unit_cost: 12, units_recent: 2, revenue_recent: 480, cost_recent: 24 }]
    );
    expect(line.profitPerUnit).toBeNull();
    expect(line.profitRecent).toBe(456);
  });

  test('the summary leaves out services that sold with no supplies set', () => {
    const lines = serviceProfitLines(
      [service({ id: 'a' }), service({ id: 'b' })],
      [
        { service_id: 'a', unit_cost: 12, units_recent: 1, revenue_recent: 180, cost_recent: 12 },
        { service_id: 'b', unit_cost: null, units_recent: 1, revenue_recent: 200, cost_recent: null },
      ]
    );
    expect(serviceProfitSummary(lines)).toEqual({ revenue: 180, cost: 12, profit: 168, uncosted: 1 });
  });
});

describe('orderProfit', () => {
  test('sales less the cost of the lines that have one', () => {
    const items = [
      { id: 'x', subtotal: 180 },
      { id: 'y', subtotal: 15 },
      { id: 'z', subtotal: 50 },
    ];
    const costs = [
      { item_id: 'x', cost: 12.5 },
      { item_id: 'y', cost: 9 },
      { item_id: 'z', cost: null },
    ];
    expect(orderProfit(items, costs)).toEqual({ revenue: 195, cost: 21.5, profit: 173.5, uncosted: 1 });
  });
});

describe('parseSupplyDraft', () => {
  test('reads a bottle', () => {
    expect(parseSupplyDraft({ name: ' Zonrox ', unit: 'ml', packSize: '1,000', packCost: '₱120' })).toEqual({
      ok: true,
      value: { name: 'Zonrox', unit: 'ml', pack_size: 1000, pack_cost: 120 },
    });
  });

  test('refuses a blank name, an empty bottle and a word for a price', () => {
    expect(parseSupplyDraft({ name: '', unit: 'ml', packSize: '1', packCost: '1' }).ok).toBe(false);
    expect(parseSupplyDraft({ name: 'A', unit: 'ml', packSize: '0', packCost: '1' }).ok).toBe(false);
    expect(parseSupplyDraft({ name: 'A', unit: 'ml', packSize: '1', packCost: 'free' }).ok).toBe(false);
  });
});

describe('parseAmount', () => {
  test('blank means the service uses none', () => {
    expect(parseAmount('')).toEqual({ ok: true, value: 0 });
    expect(parseAmount('25.5')).toEqual({ ok: true, value: 25.5 });
    expect(parseAmount('-3').ok).toBe(false);
  });
});
