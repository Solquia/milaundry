import { bookingPaymentStage, canChoosePayment } from '../booking-status';

const base = {
  status: 'pending' as const,
  order_type: 'online' as const,
  payment_status: 'unpaid' as const,
  final_total: null as number | null,
};

describe('bookingPaymentStage', () => {
  it('waits for the shop to confirm the price right after booking', () => {
    expect(bookingPaymentStage(base)).toBe('awaiting_price');
  });

  it('moves to price_confirmed once the shop sets the final total', () => {
    expect(bookingPaymentStage({ ...base, final_total: 350 })).toBe('price_confirmed');
  });

  it('is settled once payment is recorded', () => {
    expect(
      bookingPaymentStage({ ...base, final_total: 350, payment_status: 'paid' })
    ).toBe('paid');
  });

  it('has no payment stage for cancelled orders', () => {
    expect(bookingPaymentStage({ ...base, status: 'cancelled' })).toBe('none');
  });

  it('walk-in orders skip the online booking stages', () => {
    expect(bookingPaymentStage({ ...base, order_type: 'walk_in' })).toBe('none');
  });
});

describe('canChoosePayment', () => {
  it('lets the customer pick a method once the price is confirmed', () => {
    expect(canChoosePayment({ ...base, final_total: 350 })).toBe(true);
  });

  it('blocks choosing before the price is confirmed', () => {
    expect(canChoosePayment(base)).toBe(false);
  });

  it('blocks choosing after payment', () => {
    expect(
      canChoosePayment({ ...base, final_total: 350, payment_status: 'paid' })
    ).toBe(false);
  });
});
