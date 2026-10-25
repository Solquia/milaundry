import { paymentSummaryLine } from '../payment-summary';
import { validateWalkIn, type WalkInInput } from '../walk-in-order';

const input = (overrides: Partial<WalkInInput> = {}): WalkInInput => ({
  customerName: 'Aling Nena',
  customerPhone: '',
  fulfillment: 'pickup',
  deliveryAddress: '',
  paymentMethod: 'cash',
  isPaid: false,
  ...overrides,
});

describe('paying part at the counter', () => {
  it('takes the amount paid now when it is short of the bill', () => {
    const result = validateWalkIn(input({ partPaid: '100' }), 165);
    expect(result).toEqual({ ok: true, value: expect.objectContaining({ isPaid: false, partPaid: 100 }) });
  });

  it('asks for an amount when none is typed', () => {
    expect(validateWalkIn(input({ partPaid: '' }), 165)).toEqual({
      ok: false,
      errors: { partPaid: 'Enter how much they paid now.' },
    });
  });

  it('turns away the whole bill as a part', () => {
    expect(validateWalkIn(input({ partPaid: '165' }), 165)).toEqual({
      ok: false,
      errors: { partPaid: 'That is the whole bill. Choose Paid now instead.' },
    });
  });

  it('has no part when they pay all now or all later', () => {
    expect(validateWalkIn(input(), 165)).toMatchObject({ value: { partPaid: null } });
    expect(validateWalkIn(input({ isPaid: true, partPaid: '100' }), 165)).toMatchObject({
      value: { isPaid: true, partPaid: null },
    });
  });

  it('works out what is still owed', () => {
    expect(
      paymentSummaryLine({ paymentMethod: 'cash', isPaid: false, fulfillment: 'pickup', total: 165, paidNow: 100 })
    ).toBe('Paid ₱100.00 now · ₱65.00 still owed on pickup · Cash');
  });
});
