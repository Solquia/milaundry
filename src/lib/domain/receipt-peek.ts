/**
 * What a scanned receipt says about itself, before anyone claims it.
 *
 * The claim page showed the shop's name, one sentence and a button: a receipt
 * with no receipt on it. Somebody holding a printed slip could not check it
 * was theirs, or what it was for, without first attaching it to their account.
 *
 * What it may show is bounded by what the paper already says. `peek_order`
 * returns the load's own lines and totals and deliberately not the customer's
 * name, number, address or notes — a receipt dropped in the street should not
 * hand a stranger the person it belongs to.
 */
import { formatQuantity } from './price-label';
import type { PricingUnit } from './pricing';

export interface PeekedAmounts {
  estimated_total: number | null;
  final_total: number | null;
}

export interface ReceiptAmount {
  /** Null when the shop has not priced the load at all yet. */
  amount: number | null;
  label: 'Total' | 'Estimate';
  isEstimate: boolean;
}

/**
 * The figure, and the word that keeps it honest.
 *
 * `final_total` wins whenever it exists — including when it is zero, which is
 * a real answer for a redo or a goodwill wash. Written as `final ?? estimate`
 * this would fall through on a settled-at-nothing load and quote the estimate
 * as though it were owed.
 */
export function receiptAmount(order: PeekedAmounts): ReceiptAmount {
  if (order.final_total !== null && order.final_total !== undefined) {
    return { amount: order.final_total, label: 'Total', isEstimate: false };
  }
  return {
    amount: order.estimated_total ?? null,
    label: 'Estimate',
    isEstimate: true,
  };
}

export interface PeekedLine {
  service_name: string;
  unit: PricingUnit;
  quantity: number;
}

/**
 * One line of the receipt: what it was, and how much of it.
 *
 * A flat charge carries no quantity. "Pickup fee · 1 piece" invites the reader
 * to wonder what the other pieces would have been.
 */
export function receiptLineLabel(line: PeekedLine): string {
  if (line.unit === 'flat') return line.service_name;
  return `${line.service_name} · ${formatQuantity(line.unit, line.quantity)}`;
}

export interface PeekedReceiptLine extends PeekedLine {
  subtotal: number;
}

/** What `peek_order` (migration 0023) answers with. */
export interface PeekedReceipt extends PeekedAmounts {
  id: string;
  status: string;
  order_type: string;
  fulfillment: string;
  payment_status: string;
  created_at: string;
  actual_weight_kg: number | null;
  items: PeekedReceiptLine[];
}
