import { CLAIMED_TAG, RECEIPT_TAG, orderTags } from '../order-tags';

describe('order display tags', () => {
  it('tags a walk-in pickup order', () => {
    expect(
      orderTags({
        order_type: 'walk_in',
        fulfillment: 'pickup',
        payment_status: 'unpaid',
        status: 'received',
        customer_id: null,
        payment_proof_path: null,
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
        customer_id: null,
        payment_proof_path: null,
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
        customer_id: null,
        payment_proof_path: null,
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
        customer_id: null,
        payment_proof_path: null,
      })
    ).toEqual(['Online', 'Pickup']);
  });
});

describe('the claimed tag', () => {
  it('marks a walk-in that an account has claimed', () => {
    expect(
      orderTags({
        order_type: 'walk_in',
        fulfillment: 'pickup',
        payment_status: 'unpaid',
        status: 'received',
        customer_id: 'acct-1',
        payment_proof_path: null,
      })
    ).toEqual(['Walk-in', CLAIMED_TAG, 'Pickup', 'Unpaid']);
    expect(CLAIMED_TAG).toBe('Claimed');
  });

  it('never doubles up on an online order, which always has an account', () => {
    expect(
      orderTags({
        order_type: 'online',
        fulfillment: 'pickup',
        payment_status: 'unpaid',
        status: 'pending',
        customer_id: 'acct-1',
        payment_proof_path: null,
      })
    ).toEqual(['Online', 'Pickup', 'Unpaid']);
  });
});

describe('the receipt the customer sent', () => {
  it('replaces Unpaid with Receipt sent while the shop checks it', () => {
    // The board's job is to say what the counter should do next. Once a
    // customer has sent proof, "Unpaid" is no longer the instruction — the
    // instruction is to check the receipt and start the wash.
    expect(
      orderTags({
        order_type: 'walk_in',
        fulfillment: 'pickup',
        payment_status: 'unpaid',
        status: 'received',
        customer_id: 'cust-1',
        payment_proof_path: 'orders/abc/proof.jpg',
      })
    ).toEqual(['Walk-in', CLAIMED_TAG, 'Pickup', RECEIPT_TAG]);
  });

  it('drops the receipt tag once the shop has confirmed it', () => {
    expect(
      orderTags({
        order_type: 'online',
        fulfillment: 'pickup',
        payment_status: 'paid',
        status: 'washing',
        customer_id: 'cust-1',
        payment_proof_path: 'orders/abc/proof.jpg',
      })
    ).toEqual(['Online', 'Pickup', 'Paid']);
  });
});
