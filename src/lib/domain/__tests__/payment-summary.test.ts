import { PAYMENT_METHODS } from '../walk-in-order';
import {
  PAYMENT_LABELS,
  paymentSummaryLine,
  paymentToggleLabel,
} from '../payment-summary';

describe('PAYMENT_LABELS', () => {
  it('has a human label for every supported payment method', () => {
    for (const method of PAYMENT_METHODS) {
      expect(PAYMENT_LABELS[method]).toBeTruthy();
    }
  });

  it('spells GCash the way the brand does', () => {
    expect(PAYMENT_LABELS.gcash).toBe('GCash');
  });
});

describe('paymentToggleLabel', () => {
  it('confirms payment was already collected', () => {
    expect(paymentToggleLabel(true, 'pickup')).toBe('Paid now ✓');
    expect(paymentToggleLabel(true, 'delivery')).toBe('Paid now ✓');
  });

  it('says where the money will be collected when unpaid', () => {
    expect(paymentToggleLabel(false, 'pickup')).toBe('Pay later (collect on pickup)');
    expect(paymentToggleLabel(false, 'delivery')).toBe('Pay later (collect on delivery)');
  });
});

describe('paymentSummaryLine', () => {
  it('states the amount already paid and how', () => {
    expect(
      paymentSummaryLine({
        paymentMethod: 'cash',
        isPaid: true,
        fulfillment: 'pickup',
        total: 175,
      })
    ).toBe('Paid ₱175.00 · Cash');
  });

  it('states what is still to be collected on pickup', () => {
    expect(
      paymentSummaryLine({
        paymentMethod: 'gcash',
        isPaid: false,
        fulfillment: 'pickup',
        total: 175,
      })
    ).toBe('Collect ₱175.00 on pickup · GCash');
  });

  it('states what is still to be collected on delivery', () => {
    expect(
      paymentSummaryLine({
        paymentMethod: 'cash',
        isPaid: false,
        fulfillment: 'delivery',
        total: 240.5,
      })
    ).toBe('Collect ₱240.50 on delivery · Cash');
  });

  it('always shows two decimal places', () => {
    expect(
      paymentSummaryLine({
        paymentMethod: 'maya',
        isPaid: true,
        fulfillment: 'pickup',
        total: 56,
      })
    ).toBe('Paid ₱56.00 · Maya');
  });

  it('handles a zero total without crashing', () => {
    expect(
      paymentSummaryLine({
        paymentMethod: 'cash',
        isPaid: false,
        fulfillment: 'pickup',
        total: 0,
      })
    ).toBe('Collect ₱0.00 on pickup · Cash');
  });
});
