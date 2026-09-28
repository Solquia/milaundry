import { platformPulse, shopActivityLine, weekDelta, type PulseOrder, type PulseShop } from '../platform-pulse';

const NOW = new Date('2026-09-25T10:00:00Z');
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

const shops: PulseShop[] = [
  { id: 'a', name: 'Alpha', is_active: true, created_at: daysAgo(60) },
  { id: 'b', name: 'Bravo', is_active: true, created_at: daysAgo(30) },
  { id: 'c', name: 'Charlie', is_active: false, created_at: daysAgo(20) },
  { id: 'd', name: 'Delta', is_active: true, created_at: daysAgo(2) },
];

const order = (shopId: string, ago: number, total: number, extra: Partial<PulseOrder> = {}): PulseOrder => ({
  shop_id: shopId,
  status: 'completed',
  estimated_total: total,
  final_total: null,
  created_at: daysAgo(ago),
  ...extra,
});

describe('platformPulse', () => {
  it('counts orders this week against last week', () => {
    const orders = [order('a', 1, 100), order('a', 3, 100), order('b', 9, 50)];
    const pulse = platformPulse(shops, orders, NOW);
    expect(pulse.ordersThisWeek).toBe(2);
    expect(pulse.ordersLastWeek).toBe(1);
  });

  it('sums revenue from the final total when set, and skips cancelled orders', () => {
    const orders = [
      order('a', 1, 100, { final_total: 120 }),
      order('a', 2, 80),
      order('b', 2, 999, { status: 'cancelled' }),
    ];
    expect(platformPulse(shops, orders, NOW).revenueThisWeek).toBe(200);
  });

  it('buckets the last seven days oldest first, today last', () => {
    const orders = [order('a', 0.1, 10), order('a', 0.2, 10), order('b', 6.5, 10)];
    const { dailyOrders } = platformPulse(shops, orders, NOW);
    expect(dailyOrders).toHaveLength(7);
    expect(dailyOrders[6]).toBe(2);
    expect(dailyOrders[0]).toBe(1);
  });

  it('flags live shops with no orders this week as quiet, but not brand-new ones', () => {
    const orders = [order('a', 1, 10)];
    const { attention } = platformPulse(shops, orders, NOW);
    expect(attention.map((item) => [item.shopId, item.reason])).toEqual([
      ['b', 'quiet'],
      ['c', 'inactive'],
    ]);
  });

  it('ranks shops by orders this week and ignores shops with none', () => {
    const orders = [order('b', 1, 10), order('a', 1, 10), order('b', 2, 10)];
    const { leaders } = platformPulse(shops, orders, NOW);
    expect(leaders.map((leader) => [leader.shopId, leader.orders])).toEqual([
      ['b', 2],
      ['a', 1],
    ]);
  });

  it('counts live shops', () => {
    expect(platformPulse(shops, [], NOW).liveShops).toBe(3);
  });
});

describe('shopActivityLine', () => {
  it('describes a busy shop by its week', () => {
    expect(shopActivityLine({ ordersThisWeek: 12, lastOrderAt: daysAgo(0.1) }, NOW)).toBe(
      '12 orders this week'
    );
  });

  it('uses the singular for one order', () => {
    expect(shopActivityLine({ ordersThisWeek: 1, lastOrderAt: daysAgo(1) }, NOW)).toBe(
      '1 order this week'
    );
  });

  it('says how long a quiet shop has been quiet', () => {
    expect(shopActivityLine({ ordersThisWeek: 0, lastOrderAt: daysAgo(12) }, NOW)).toBe(
      'Last order 12 days ago'
    );
  });

  it('says when a shop has taken nothing in the whole window', () => {
    expect(shopActivityLine({ ordersThisWeek: 0, lastOrderAt: null }, NOW)).toBe('No orders in 4 weeks');
  });
});

describe('weekDelta', () => {
  it('shows growth and decline as percentages', () => {
    expect(weekDelta(14, 10)).toBe('+40%');
    expect(weekDelta(8, 10)).toBe('−20%');
  });

  it('calls an unchanged week flat', () => {
    expect(weekDelta(5, 5)).toBe('Flat');
  });

  it('has no percentage against an empty week', () => {
    expect(weekDelta(3, 0)).toBe('New');
    expect(weekDelta(0, 0)).toBeNull();
  });
});
