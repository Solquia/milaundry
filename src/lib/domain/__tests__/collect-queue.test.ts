import { OVERDUE_AFTER_DAYS, nudgeMessage, smsLink, splitCollect, type CollectOrder } from '../collect-queue';

const NOW = new Date(2026, 8, 28, 14, 15);
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

let seq = 0;
function order(overrides: Partial<CollectOrder> = {}): CollectOrder {
  seq += 1;
  return {
    id: `o${seq}`,
    status: 'ready',
    payment_status: 'unpaid',
    order_type: 'walk_in',
    customer_id: null,
    customer_name: 'Aling Nena',
    customer_phone: '09171234567',
    estimated_total: 200,
    final_total: null,
    created_at: daysAgo(1),
    updated_at: daysAgo(1),
    ...overrides,
  };
}

describe('money still to collect', () => {
  it('splits unpaid laundry into ready, overdue and still washing', () => {
    const split = splitCollect(
      [
        order({ final_total: 180 }),
        order({ status: 'completed', updated_at: daysAgo(OVERDUE_AFTER_DAYS + 1) }),
        order({ status: 'washing' }),
        order({ status: 'pending' }),
        order({ payment_status: 'paid' }),
        order({ status: 'cancelled' }),
      ],
      NOW
    );
    expect([split.ready.count, split.ready.amount]).toEqual([1, 180]);
    expect([split.overdue.count, split.overdue.amount]).toEqual([1, 200]);
    expect([split.washing.count, split.washing.amount]).toEqual([2, 400]);
  });

  it('lists the overdue oldest first so the longest wait is chased first', () => {
    const older = order({ status: 'ready', updated_at: daysAgo(9) });
    const newer = order({ status: 'ready', updated_at: daysAgo(4) });
    const split = splitCollect([newer, older], NOW);
    expect(split.overdue.orders.map((o) => o.id)).toEqual([older.id, newer.id]);
  });
});

describe('the nudge', () => {
  const shop = { name: 'SmellFresh', gcash_number: '09998887777', gcash_name: 'J. Cruz' };

  it('tells a customer their laundry is ready and how to pay', () => {
    const text = nudgeMessage(order({ final_total: 180 }), shop);
    expect(text).toContain('Hi Aling Nena');
    expect(text).toContain('ready');
    expect(text).toContain('₱180.00');
    expect(text).toContain('GCash 09998887777 (J. Cruz)');
  });

  it('reminds a customer who already took their laundry, without saying it is ready', () => {
    const text = nudgeMessage(order({ status: 'completed' }), { ...shop, gcash_number: null });
    expect(text).not.toContain('ready');
    expect(text).not.toContain('GCash');
    expect(text).toContain('still unpaid');
  });

  it('builds an SMS link each platform understands', () => {
    expect(smsLink('0917 123 4567', 'Hi there', 'ios')).toBe('sms:09171234567&body=Hi%20there');
    expect(smsLink('0917 123 4567', 'Hi there', 'android')).toBe('sms:09171234567?body=Hi%20there');
  });
});
