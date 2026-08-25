import { formatMoney } from './money';
import type { Fulfillment, PaymentMethod } from './walk-in-order';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  card: 'Card',
  other: 'Other',
};

/** Where the money changes hands when the customer has not paid yet. */
function collectionPoint(fulfillment: Fulfillment): string {
  return fulfillment === 'delivery' ? 'delivery' : 'pickup';
}

/**
 * Label for the dedicated "Paid upfront" button that sits directly above
 * Save, so the owner records payment at the moment they close the order.
 */
export function paidUpfrontLabel(isPaid: boolean): string {
  return isPaid ? 'Paid upfront ✓' : 'Paid upfront';
}

export interface PaymentSummaryInput {
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  fulfillment: Fulfillment;
  total: number;
}

/** One-line payment recap shown next to the order total, e.g. `Paid ₱175.00 · Cash`. */
export function paymentSummaryLine({
  paymentMethod,
  isPaid,
  fulfillment,
  total,
}: PaymentSummaryInput): string {
  const amount = formatMoney(total);
  const method = PAYMENT_LABELS[paymentMethod];
  if (isPaid) return `Paid ${amount} · ${method}`;
  return `Collect ${amount} on ${collectionPoint(fulfillment)} · ${method}`;
}
