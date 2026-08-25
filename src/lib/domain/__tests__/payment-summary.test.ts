import { PAYMENT_METHODS } from '../walk-in-order';
import {
  PAYMENT_LABELS,
  paidUpfrontLabel,
  paymentSummaryLine,
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

describe('paidUpfrontLabel', () => {
  it('offers to record an upfront payment when nothing is paid yet', () => {
    expect(paidUpfrontLabel(false)).toBe('Paid upfront');
  });

  it('confirms the order is already settled once toggled on', () => {
    expect(paidUpfrontLabel(true)).toBe('Paid upfront ✓');
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
