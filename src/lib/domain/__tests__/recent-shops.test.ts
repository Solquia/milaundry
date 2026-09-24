import { quickBookTarget, recentShops, type RecentShopOrder } from '../recent-shops';

function order(overrides: Partial<RecentShopOrder> & { id: string }): RecentShopOrder {
  return {
    shop_id: 'shop-a',
    status: 'completed',
    created_at: '2026-09-01T10:00:00Z',
    fulfillment: 'pickup',
    delivery_address: '',
    notes: '',
    shop: { id: 'shop-a', name: 'Sparkle Wash', logo_url: '', brand_accent: null },
    order_items: [
      { service_id: 's-wash', service_name: 'Wash & Fold', unit: 'per_kg', quantity: 5 },
    ],
    ...overrides,
  };
}

const shopB = { id: 'shop-b', name: 'Bubble Bros', logo_url: 'b.png', brand_accent: 3 };

describe('recentShops', () => {
  it('lists each shop once, newest order first', () => {
    const rows = recentShops([
      order({ id: 'o1', created_at: '2026-09-01T10:00:00Z' }),
      order({ id: 'o2', shop_id: 'shop-b', shop: shopB, created_at: '2026-09-03T10:00:00Z' }),
      order({ id: 'o3', created_at: '2026-09-02T10:00:00Z' }),
    ]);
    expect(rows.map((row) => row.shopId)).toEqual(['shop-b', 'shop-a']);
    expect(rows[1].lastOrderAt).toBe('2026-09-02T10:00:00Z');
  });

  it('says what was booked last time', () => {
    const [row] = recentShops([order({ id: 'o1' })]);
    expect(row.lastSummary).toBe('Wash & Fold · 5 kg');
    expect(row.rebookHref).toBe('/(customer)/book/s-wash?shopId=shop-a&rebook=o1');
  });

  it('rebooks from the newest order that is not cancelled', () => {
    const [row] = recentShops([
      order({ id: 'old', created_at: '2026-09-01T10:00:00Z' }),
      order({ id: 'cancelled', status: 'cancelled', created_at: '2026-09-05T10:00:00Z' }),
    ]);
    expect(row.rebookHref).toContain('rebook=old');
  });

  it('still lists a shop whose orders cannot be rebooked, without a shortcut', () => {
    const [row] = recentShops([order({ id: 'o1', status: 'cancelled' })]);
    expect(row.shopId).toBe('shop-a');
    expect(row.rebookHref).toBeNull();
    expect(row.lastSummary).toBeNull();
  });

  it('leaves out a shop the customer can no longer see', () => {
    expect(recentShops([order({ id: 'o1', shop: null })])).toEqual([]);
  });

  it('stops at the limit', () => {
    const many = ['a', 'b', 'c', 'd'].map((key, index) =>
      order({
        id: `o-${key}`,
        shop_id: key,
        shop: { ...shopB, id: key },
        created_at: `2026-09-0${index + 1}T10:00:00Z`,
      })
    );
    expect(recentShops(many, 3)).toHaveLength(3);
  });
});

describe('quickBookTarget', () => {
  it('rebooks the newest laundry when there is one', () => {
    const recent = recentShops([order({ id: 'o1' })]);
    expect(quickBookTarget(recent, [])).toEqual({
      kind: 'rebook',
      href: '/(customer)/book/s-wash?shopId=shop-a&rebook=o1',
      shopName: 'Sparkle Wash',
      summary: 'Wash & Fold · 5 kg',
    });
  });

  it('skips a recent shop with nothing to rebook for the next one that has', () => {
    const recent = recentShops([
      order({ id: 'x', status: 'cancelled', created_at: '2026-09-09T10:00:00Z' }),
      order({ id: 'y', shop_id: 'shop-b', shop: shopB, created_at: '2026-09-01T10:00:00Z' }),
    ]);
    expect(quickBookTarget(recent, [])).toMatchObject({ kind: 'rebook', shopName: 'Bubble Bros' });
  });

  it('opens a connected shop when there is no order yet', () => {
    expect(quickBookTarget([], [{ id: 'shop-b', name: 'Bubble Bros' }])).toEqual({
      kind: 'shop',
      href: '/(customer)/shop/shop-b',
      shopName: 'Bubble Bros',
    });
  });

  it('sends a brand-new customer to find a shop', () => {
    expect(quickBookTarget([], [])).toEqual({ kind: 'find', href: '/(customer)/shops' });
  });
});
