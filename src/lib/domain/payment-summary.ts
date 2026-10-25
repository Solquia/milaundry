import { formatMoney, roundCentavos } from './money';
import type { Fulfillment, PaymentMethod } from './walk-in-order';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  maya: 'Maya',
  card: 'Card',
  bank_transfer: 'Bank transfer',
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
  /** Paid now when only part of the bill was paid; the rest is still owed. */
  paidNow?: number;
}

/** One-line payment recap shown next to the order total, e.g. `Paid ₱175.00 · Cash`. */
export function paymentSummaryLine({
  paymentMethod,
  isPaid,
  fulfillment,
  total,
  paidNow = 0,
}: PaymentSummaryInput): string {
  const amount = formatMoney(total);
  const method = PAYMENT_LABELS[paymentMethod];
  if (isPaid) return `Paid ${amount} · ${method}`;
  if (paidNow > 0 && paidNow < total) {
    const owed = formatMoney(roundCentavos(total - paidNow));
    return `Paid ${formatMoney(paidNow)} now · ${owed} still owed on ${collectionPoint(fulfillment)} · ${method}`;
  }
  return `Collect ${amount} on ${collectionPoint(fulfillment)} · ${method}`;
}
