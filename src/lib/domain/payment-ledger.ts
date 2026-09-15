/**
 * The shop's payments, in one list, so nobody has to open orders one by one.
 *
 * Money moves outside this app. `payment-proof.ts` is careful about what that
 * means for a single order; this module is the same care applied to all of
 * them at once. The list is a record of *claims* and the shop's answers to
 * them — never a statement that money arrived, because the app cannot see the
 * shop's balance. The queue exists so an owner can sit down with their GCash
 * or Maya app open and work through the receipts with the reference numbers
 * in front of them.
 *
 * Two lists rather than one, because they are read for opposite reasons. The
 * queue is work outstanding, so it runs oldest first: the customer who has
 * been waiting longest on the shop is the one the shop owes an answer to. The
 * record is a log, so it runs newest first, which is where anyone looking up
 * "did that one go through" starts.
 *
 * Settlement is decided by `proofState`, not re-derived here. A reference
 * number is not a payment, a screenshot is not a payment, and only the shop
 * marking the order paid moves a claim out of the queue.
 */
import { proofState, type ProofableOrder } from './payment-proof';
import type { PaymentMethod } from './walk-in-order';

export interface LedgerOrder extends ProofableOrder {
  id: string;
  /** As written on the order, so a walk-in without an account still has a name. */
  customer_name: string;
  /** What the customer copied off their receipt. Optional on their side. */
  payment_reference: string | null;
  paid_at: string | null;
  updated_at: string;
}

export interface PaymentClaim {
  orderId: string;
  customerName: string;
  /** What the customer was actually asked for, once the load was weighed. */
  amount: number;
  method: PaymentMethod;
  /** Kept verbatim: the spacing is how the number is printed and read back. */
  reference: string | null;
  proofPath: string | null;
  /** When it was settled, or when the receipt came in. ISO-8601. */
  at: string;
  isConfirmed: boolean;
}

export interface PaymentLedger {
  /** Receipts the shop has not answered yet. Longest wait first. */
  toCheck: PaymentClaim[];
  /** Money the shop has confirmed taking. Most recent first. */
  confirmed: PaymentClaim[];
}

function toClaim(order: LedgerOrder, isConfirmed: boolean): PaymentClaim {
  return {
    orderId: order.id,
    customerName: order.customer_name,
    // Only a weighed order reaches either list, so the total is settled by the
    // time it gets here; the fallback keeps the type honest rather than
    // describing a case the filter lets through.
    amount: order.final_total ?? 0,
    method: order.payment_method,
    reference: order.payment_reference,
    proofPath: order.payment_proof_path,
    // A settled order is dated by when it was settled. `paid_at` is only
    // missing on rows written before the column existed, and the last change
    // to those is the closest thing to the truth we have.
    at: isConfirmed ? (order.paid_at ?? order.updated_at) : order.updated_at,
    isConfirmed,
  };
}

function byTime(direction: 'oldest-first' | 'newest-first') {
  const sign = direction === 'oldest-first' ? 1 : -1;
  return (a: PaymentClaim, b: PaymentClaim) => sign * a.at.localeCompare(b.at);
}

/** Every payment this shop has been told about, split by whether it answered. */
export function paymentLedger(orders: readonly LedgerOrder[]): PaymentLedger {
  const toCheck: PaymentClaim[] = [];
  const confirmed: PaymentClaim[] = [];

  for (const order of orders) {
    const state = proofState(order);
    if (state === 'submitted') toCheck.push(toClaim(order, false));
    else if (state === 'confirmed') confirmed.push(toClaim(order, true));
  }

  return {
    toCheck: toCheck.sort(byTime('oldest-first')),
    confirmed: confirmed.sort(byTime('newest-first')),
  };
}

/**
 * How many receipts are waiting on the shop — the number on the tab.
 *
 * Counts the queue only. A badge that included settled payments would never
 * reach zero, and a badge that never reaches zero is furniture.
 */
export function claimsToCheck(orders: readonly LedgerOrder[]): number {
  return orders.filter((order) => proofState(order) === 'submitted').length;
}
