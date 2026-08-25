import { orderTags } from '../order-tags';

describe('order display tags', () => {
  it('tags a walk-in pickup order', () => {
    expect(
      orderTags({
        order_type: 'walk_in',
        fulfillment: 'pickup',
        payment_status: 'unpaid',
        status: 'received',
      })
    ).toEqual(['Walk-in', 'Pickup', 'Unpaid']);
  });

  it('tags an online delivery order', () => {
    expect(
      orderTags({
        order_type: 'online',
        fulfillment: 'delivery',
        payment_status: 'unpaid',
        status: 'pending',
      })
    ).toEqual(['Online', 'Delivery', 'Unpaid']);
  });

  it('shows Paid instead of Unpaid once settled', () => {
    expect(
      orderTags({
        order_type: 'walk_in',
        fulfillment: 'pickup',
        payment_status: 'paid',
        status: 'washing',
      })
    ).toEqual(['Walk-in', 'Pickup', 'Paid']);
  });

  it('omits the payment tag for cancelled orders', () => {
    expect(
      orderTags({
        order_type: 'online',
        fulfillment: 'pickup',
        payment_status: 'unpaid',
        status: 'cancelled',
      })
    ).toEqual(['Online', 'Pickup']);
  });
});
