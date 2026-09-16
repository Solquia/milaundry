import { orderOnShow } from '../storefront-order';

const SHOP = 'shop-1';
const OTHER = 'shop-2';

/** Newest first, the way `getMyOrders` hands them over. */
function order(id: string, shop_id: string, status: string) {
  return { id, shop_id, status } as Parameters<typeof orderOnShow>[0][number];
}

describe('orderOnShow', () => {
  it('has nothing to show when nothing was ordered here', () => {
    expect(orderOnShow([], SHOP)).toBeNull();
    expect(orderOnShow([order('a', OTHER, 'washing')], SHOP)).toBeNull();
  });

  it('shows the laundry that is still moving', () => {
    const orders = [order('new', SHOP, 'pending'), order('old', SHOP, 'washing')];
    expect(orderOnShow(orders, SHOP)?.id).toBe('new');
  });

  it('prefers a live order over a newer finished one', () => {
    // The band answers "where is my laundry", so an order still in the shop
    // outranks one that was collected this morning, whatever the order of the
    // list. Anything else and a customer with a wash running is told it is done.
    const orders = [order('done', SHOP, 'completed'), order('live', SHOP, 'drying')];
    expect(orderOnShow(orders, SHOP)?.id).toBe('live');
  });

  it('falls back to the last one collected, so the band still says something', () => {
    const orders = [order('recent', SHOP, 'completed'), order('older', SHOP, 'completed')];
    expect(orderOnShow(orders, SHOP)?.id).toBe('recent');
  });

  it('never surfaces a cancelled order as the state of a laundry', () => {
    expect(orderOnShow([order('x', SHOP, 'cancelled')], SHOP)).toBeNull();
    const mixed = [order('x', SHOP, 'cancelled'), order('done', SHOP, 'completed')];
    expect(orderOnShow(mixed, SHOP)?.id).toBe('done');
  });

  it('ignores every other shop the customer has used', () => {
    const orders = [order('theirs', OTHER, 'pending'), order('mine', SHOP, 'ready')];
    expect(orderOnShow(orders, SHOP)?.id).toBe('mine');
  });

  it('has nothing to show without a shop to match against', () => {
    expect(orderOnShow([order('a', SHOP, 'ready')], undefined)).toBeNull();
  });
});
