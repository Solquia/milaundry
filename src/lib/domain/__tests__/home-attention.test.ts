import { homeAttention, type AttentionOrder } from '../home-attention';

const base: AttentionOrder = {
  id: 'order-1',
  shopName: 'Sparkle Wash',
  status: 'washing',
  order_type: 'online',
  customer_id: 'cust-1',
  payment_status: 'unpaid',
  payment_method: 'gcash',
  final_total: 350,
  payment_proof_path: null,
  updated_at: '2026-08-28T10:00:00Z',
};

describe('homeAttention', () => {
  it('pings a weighed order with the amount owed', () => {
    const cards = homeAttention([base]);

    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('pay');
    expect(cards[0].orderId).toBe('order-1');
    expect(cards[0].title).toContain('350');
  });

  it('stays quiet while the price is still an estimate', () => {
    expect(homeAttention([{ ...base, final_total: null }])).toHaveLength(0);
  });

  it('stays quiet once the shop has confirmed payment', () => {
    expect(homeAttention([{ ...base, payment_status: 'paid' }])).toHaveLength(0);
  });

  it('never pings an unclaimed walk-in or a cancelled order', () => {
    expect(
      homeAttention([
        { ...base, order_type: 'walk_in', customer_id: null },
        { ...base, id: 'order-2', status: 'cancelled' },
      ])
    ).toHaveLength(0);
  });

  it('pings a claimed walk-in the same as a booking: someone holds it', () => {
    const cards = homeAttention([{ ...base, order_type: 'walk_in' }]);
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('pay');
  });

  it('turns a sent receipt into a quiet "being checked" note, not a demand', () => {
    const cards = homeAttention([
      { ...base, payment_proof_path: 'order-1/proof-1.jpg' },
    ]);

    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('checking');
  });

  it('still asks a cash payer to settle, in counter words', () => {
    const cards = homeAttention([{ ...base, payment_method: 'cash' }]);

    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('pay');
  });

  it('puts what is owed above what is merely being checked', () => {
    const cards = homeAttention([
      {
        ...base,
        id: 'checking-first',
        payment_proof_path: 'p.jpg',
        updated_at: '2026-08-28T12:00:00Z',
      },
      { ...base, id: 'pay-later', updated_at: '2026-08-27T09:00:00Z' },
    ]);

    expect(cards.map((card) => card.orderId)).toEqual(['pay-later', 'checking-first']);
  });

  it('orders two unpaid bills newest change first', () => {
    const cards = homeAttention([
      { ...base, id: 'older', updated_at: '2026-08-26T10:00:00Z' },
      { ...base, id: 'newer', updated_at: '2026-08-28T10:00:00Z' },
    ]);

    expect(cards.map((card) => card.orderId)).toEqual(['newer', 'older']);
  });
});
