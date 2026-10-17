import {
  LOW_STOCK_AT,
  STOCK_LIMIT,
  bestSellers,
  parseStockInput,
  restockOrder,
  restockedCount,
  stockLines,
  stockStatus,
  stockSummary,
  type AddonSales,
} from '../addon-inventory';
import type { ShopAddon } from '../shop-addons';

function addon(overrides: Partial<ShopAddon>): ShopAddon {
  return {
    id: 'a',
    shop_id: 'shop-1',
    kind: 'detergent',
    name: 'Ariel',
    note: '',
    price: 15,
    image_url: null,
    is_active: true,
    sort_order: 0,
    max_quantity: 1,
    ...overrides,
  };
}

function sales(overrides: Partial<AddonSales> & { addon_id: string }): AddonSales {
  return { sold_since_count: 0, sold_recent: 0, sold_total: 0, revenue_recent: 0, ...overrides };
}

describe('stockStatus', () => {
  test('an add-on never counted is not tracked', () => {
    expect(stockStatus(null)).toBe('untracked');
  });

  test('none left is out, a few left is low, more is in stock', () => {
    expect(stockStatus(0)).toBe('out');
    expect(stockStatus(LOW_STOCK_AT)).toBe('low');
    expect(stockStatus(LOW_STOCK_AT + 1)).toBe('ok');
  });
});

describe('stockLines', () => {
  test('what is left is the count less what sold since it', () => {
    const [line] = stockLines(
      [addon({ id: 'ariel', stock_count: 30 })],
      [sales({ addon_id: 'ariel', sold_since_count: 12, sold_recent: 20, sold_total: 40 })]
    );
    expect(line.counted).toBe(30);
    expect(line.left).toBe(18);
    expect(line.soldRecent).toBe(20);
    expect(line.soldTotal).toBe(40);
    expect(line.status).toBe('ok');
  });

  test('selling more than was counted leaves none, never a negative', () => {
    const [line] = stockLines(
      [addon({ id: 'ariel', stock_count: 3 })],
      [sales({ addon_id: 'ariel', sold_since_count: 5 })]
    );
    expect(line.left).toBe(0);
    expect(line.status).toBe('out');
  });

  test('an uncounted add-on still shows its sales, with nothing left to say', () => {
    const [line] = stockLines(
      [addon({ id: 'downy' })],
      [sales({ addon_id: 'downy', sold_recent: 4, sold_total: 9 })]
    );
    expect(line.left).toBeNull();
    expect(line.soldTotal).toBe(9);
    expect(line.status).toBe('untracked');
  });

  test('an add-on with no sales row has sold nothing', () => {
    const [line] = stockLines([addon({ id: 'del', stock_count: 10 })], []);
    expect(line.left).toBe(10);
    expect(line.soldRecent).toBe(0);
  });
});

describe('bestSellers', () => {
  const lines = stockLines(
    [
      addon({ id: 'ariel', name: 'Ariel' }),
      addon({ id: 'tide', name: 'Tide' }),
      addon({ id: 'downy', name: 'Downy', kind: 'fabcon' }),
      addon({ id: 'del', name: 'Del', kind: 'fabcon' }),
      addon({ id: 'surf', name: 'Surf' }),
    ],
    [
      sales({ addon_id: 'ariel', sold_recent: 5, revenue_recent: 75 }),
      sales({ addon_id: 'tide', sold_recent: 9, revenue_recent: 135 }),
      sales({ addon_id: 'downy', sold_recent: 5, revenue_recent: 100 }),
      sales({ addon_id: 'del', sold_recent: 1, revenue_recent: 10 }),
    ]
  );

  test('most sold first, ties going to the one that took more money, top three only', () => {
    expect(bestSellers(lines).map((line) => line.addon.id)).toEqual(['tide', 'downy', 'ariel']);
  });

  test('something that sold nothing is never a best seller', () => {
    expect(bestSellers(lines, 10).map((line) => line.addon.id)).not.toContain('surf');
  });
});

describe('stockSummary', () => {
  test('adds up what is left and sold, and counts what needs restocking or counting', () => {
    const lines = stockLines(
      [
        addon({ id: 'ariel', stock_count: 20 }),
        addon({ id: 'tide', stock_count: 4 }),
        addon({ id: 'surf', stock_count: 0 }),
        addon({ id: 'downy' }),
      ],
      [
        sales({ addon_id: 'ariel', sold_since_count: 2, sold_recent: 6, revenue_recent: 90.1 }),
        sales({ addon_id: 'downy', sold_recent: 3, revenue_recent: 30.2 }),
      ]
    );
    expect(stockSummary(lines)).toEqual({
      left: 22,
      soldRecent: 9,
      revenueRecent: 120.3,
      needRestock: 2,
      uncounted: 1,
    });
  });
});

describe('restockOrder', () => {
  test('out first, then low, then in stock, uncounted last', () => {
    const lines = stockLines(
      [
        addon({ id: 'uncounted' }),
        addon({ id: 'plenty', stock_count: 40 }),
        addon({ id: 'low', stock_count: 2 }),
        addon({ id: 'out', stock_count: 0 }),
      ],
      []
    );
    expect(restockOrder(lines).map((line) => line.addon.id)).toEqual([
      'out',
      'low',
      'plenty',
      'uncounted',
    ]);
  });
});

describe('parseStockInput', () => {
  test('takes a whole number of packs, spaces and all', () => {
    expect(parseStockInput(' 12 ')).toEqual({ ok: true, value: 12 });
    expect(parseStockInput('0')).toEqual({ ok: true, value: 0 });
  });

  test('turns away blanks, fractions, negatives and the absurd', () => {
    expect(parseStockInput('').ok).toBe(false);
    expect(parseStockInput('2.5').ok).toBe(false);
    expect(parseStockInput('-1').ok).toBe(false);
    expect(parseStockInput('abc').ok).toBe(false);
    expect(parseStockInput(String(STOCK_LIMIT + 1)).ok).toBe(false);
  });
});

describe('restockedCount', () => {
  test('a delivery lands on what is left', () => {
    expect(restockedCount({ left: 3 }, 24)).toBe(27);
  });

  test('a first delivery of an uncounted add-on starts from nothing', () => {
    expect(restockedCount({ left: null }, 24)).toBe(24);
  });

  test('never past the limit', () => {
    expect(restockedCount({ left: STOCK_LIMIT }, 1)).toBe(STOCK_LIMIT);
  });
});
