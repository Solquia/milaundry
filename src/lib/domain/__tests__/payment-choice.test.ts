import { cashChoiceCopy, merchantCashChoiceNote } from '../payment-proof';

describe('cashChoiceCopy', () => {
  it('says pickup or delivery the way the order is fulfilled', () => {
    expect(cashChoiceCopy('Sparkle clean', false).sendLabel).toBe(
      "Tell Sparkle clean I'll pay cash at pickup"
    );
    expect(cashChoiceCopy('Sparkle clean', true).sentNote).toBe(
      "Sent. Sparkle clean knows you'll pay cash on delivery."
    );
  });
});

describe('merchantCashChoiceNote', () => {
  const base = {
    payment_method: 'cash' as const,
    payment_status: 'unpaid' as const,
    payment_choice_sent_at: '2026-10-14T10:00:00Z',
    fulfillment: 'pickup',
    customer_name: 'Maria',
  };

  it('tells the counter the customer chose cash', () => {
    expect(merchantCashChoiceNote(base)).toBe('Maria will pay cash at pickup.');
  });

  it('says nothing for a default nobody sent', () => {
    expect(merchantCashChoiceNote({ ...base, payment_choice_sent_at: null })).toBeNull();
  });

  it('says nothing once paid, or for an online rail', () => {
    expect(merchantCashChoiceNote({ ...base, payment_status: 'paid' })).toBeNull();
    expect(merchantCashChoiceNote({ ...base, payment_method: 'gcash' })).toBeNull();
  });
});
