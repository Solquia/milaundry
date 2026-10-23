import type { AddonCost, AddonSales } from '../addon-inventory';
import { frameFor } from '../sales-period';
import type { SupplyUse } from '../service-costs';
import type { ShopAddon } from '../shop-addons';
import { shopStock, type StockOrder } from '../shop-stock';

// Monday 28 Sep 2026, 2:15 PM local.
const NOW = new Date(2026, 8, 28, 14, 15);
const iso = (d: number, h: number) => new Date(2026, 8, d, h).toISOString();
const today = frameFor({ kind: 'day', offset: 0 }, NOW);

function addon(id: string, name: string, extra: Partial<ShopAddon> = {}): ShopAddon {
  return {
    id,
    shop_id: 's1',
    kind: 'detergent',
    name,
    price: 15,
    is_active: true,
    stock_count: null,
    ...extra,
  } as ShopAddon;
}

const sales = (addon_id: string, sold_since_count: number): AddonSales => ({
  addon_id,
  sold_since_count,
  sold_recent: sold_since_count,
  sold_total: sold_since_count,
  revenue_recent: sold_since_count * 15,
});

const cost = (addon_id: string, unit_cost: number | null): AddonCost => ({
  addon_id,
  unit_cost,
  cost_recent: unit_cost,
});

function order(items: StockOrder['order_items'], extra: Partial<StockOrder> = {}): StockOrder {
  return { status: 'completed', created_at: iso(28, 9), order_items: items, ...extra };
}

const ariel = addon('a1', 'Ariel', { stock_count: 10 });
const downy = addon('a2', 'Downy', { stock_count: 4 });
const surf = addon('a3', 'Surf', { stock_count: 3 });
const zonrox = addon('a4', 'Zonrox');

describe('shopStock', () => {
  it('lists what needs restocking, out first, and counts the shelf never counted', () => {
    const stock = shopStock({
      orders: [],
      addons: [ariel, downy, surf, zonrox],
      sales: [sales('a1', 2), sales('a2', 1), sales('a3', 3)],
      costs: [],
      supplyUse: [],
      frame: today,
    });

    expect(stock.restock.map((line) => [line.addon.name, line.left])).toEqual([
      ['Surf', 0],
      ['Downy', 3],
    ]);
    expect(stock.uncounted).toBe(1);
  });

  it('counts the add-ons sold in the period, with what is left of each', () => {
    const orders = [
      order([
        { addon_id: 'a1', quantity: 2, service_name: 'Ariel' },
        { addon_id: null, quantity: 5, service_name: 'Wash' },
      ]),
      order([{ addon_id: 'a1', quantity: 1, service_name: 'Ariel' }]),
      // Yesterday, and a cancelled one: neither counts.
      order([{ addon_id: 'a2', quantity: 1, service_name: 'Downy' }], { created_at: iso(27, 9) }),
      order([{ addon_id: 'a2', quantity: 4, service_name: 'Downy' }], { status: 'cancelled' }),
    ];

    const stock = shopStock({
      orders,
      addons: [ariel, downy],
      sales: [sales('a1', 3)],
      costs: [],
      supplyUse: [],
      frame: today,
    });

    expect(stock.addonsSold).toEqual([{ id: 'a1', name: 'Ariel', quantity: 3, left: 7, status: 'ok' }]);
  });

  it('turns supply use into bottles, and totals its cost', () => {
    const use: SupplyUse[] = [
      { supplyId: 's1', name: 'Zonrox Bleach', unit: 'ml', packSize: 1000, amount: 310, cost: 26.35 },
      { supplyId: 's2', name: 'SF Detergent', unit: 'ml', packSize: 1000, amount: 2540, cost: 51.02 },
    ];

    const stock = shopStock({ orders: [], addons: [], sales: [], costs: [], supplyUse: use, frame: today });

    expect(stock.supplies.map((row) => [row.name, row.amount, row.packs])).toEqual([
      ['Zonrox Bleach', 310, 0.3],
      ['SF Detergent', 2540, 2.5],
    ]);
    expect(stock.suppliesCost).toBe(77.37);
  });

  it('flags add-ons on sale with no cost price', () => {
    const stock = shopStock({
      orders: [],
      addons: [ariel, downy, addon('a5', 'Old', { is_active: false })],
      sales: [],
      costs: [cost('a1', 8), cost('a2', null)],
      supplyUse: [],
      frame: today,
    });

    expect(stock.addonsWithoutCost).toBe(1);
  });
});
