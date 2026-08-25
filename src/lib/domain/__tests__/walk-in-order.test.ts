import { PAYMENT_METHODS, validateWalkIn } from '../walk-in-order';

const base = {
  customerName: 'Maria Santos',
  customerPhone: '0917 123 4567',
  fulfillment: 'pickup' as const,
  deliveryAddress: '',
  paymentMethod: 'cash' as const,
  isPaid: false,
};

describe('walk-in order validation', () => {
  it('accepts a complete pickup walk-in and normalizes values', () => {
    const result = validateWalkIn(base);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.customerName).toBe('Maria Santos');
      expect(result.value.customerPhone).toBe('+639171234567');
      expect(result.value.fulfillment).toBe('pickup');
      expect(result.value.deliveryAddress).toBe('');
    }
  });

  it('requires a customer name', () => {
    const result = validateWalkIn({ ...base, customerName: '   ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.customerName).toBeTruthy();
  });

  it('allows an empty phone (walk-in without contact number)', () => {
    const result = validateWalkIn({ ...base, customerPhone: '' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.customerPhone).toBe('');
  });

  it('rejects an invalid phone', () => {
    const result = validateWalkIn({ ...base, customerPhone: '12345' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.customerPhone).toBeTruthy();
  });

  it('requires an address when fulfillment is delivery', () => {
    const result = validateWalkIn({ ...base, fulfillment: 'delivery' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.deliveryAddress).toBeTruthy();
  });

  it('accepts a delivery walk-in with an address', () => {
    const result = validateWalkIn({
      ...base,
      fulfillment: 'delivery',
      deliveryAddress: ' 12 Mabini St, Quezon City ',
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.deliveryAddress).toBe('12 Mabini St, Quezon City');
  });

  it('drops the address for pickup orders even if one was typed', () => {
    const result = validateWalkIn({ ...base, deliveryAddress: 'left over text' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.deliveryAddress).toBe('');
  });

  it('exposes the supported payment methods', () => {
    expect(PAYMENT_METHODS).toEqual([
      'cash',
      'gcash',
      'maya',
      'card',
      'bank_transfer',
      'other',
    ]);
  });

  it('rejects an unknown payment method', () => {
    const result = validateWalkIn({ ...base, paymentMethod: 'bitcoin' as never });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.paymentMethod).toBeTruthy();
  });

  it('reports all errors at once', () => {
    const result = validateWalkIn({
      ...base,
      customerName: '',
      customerPhone: 'abc',
      fulfillment: 'delivery',
      deliveryAddress: '',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.customerName).toBeTruthy();
      expect(result.errors.customerPhone).toBeTruthy();
      expect(result.errors.deliveryAddress).toBeTruthy();
    }
  });
});
