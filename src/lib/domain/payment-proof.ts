/**
 * The receipt, and who is waiting on whom.
 *
 * Money moves outside this app: the customer sends it in GCash, Maya, or their
 * bank, and the shop sees it land in their own account. What the app holds is a
 * *claim* — a screenshot and a reference number — and the shop's confirmation
 * of it. Being precise about that distinction is the whole job of this module.
 * The app must never tell a shop that money arrived; it can only tell them a
 * customer says it did, and ask them to check.
 *
 * Sits beside `booking-status.ts`, which tracks the price half of the same
 * journey. That one ends where this one begins: at `price_confirmed`.
 */
import type { OrderStatus } from './order-status';
import type { OrderType, PaymentStatus } from './order-tags';
import type { PaymentMethod } from './walk-in-order';

export type ProofState =
  /** Unclaimed walk-in or cancelled: nobody in the app to settle with. */
  | 'not_applicable'
  /** Booked, but the shop has not put it on the scale yet. */
  | 'awaiting_price'
  /** Weighed, and being settled in cash across the counter. */
  | 'awaiting_counter'
  /** Weighed, an online rail chosen, nothing sent yet. */
  | 'awaiting_payment'
  /** Receipt uploaded; the shop has not confirmed it. */
  | 'submitted'
  | 'confirmed';

export interface ProofableOrder {
  order_type: OrderType;
  /** The account holding the order; null for a walk-in nobody has scanned. */
  customer_id: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  final_total: number | null;
  payment_proof_path: string | null;
}

/**
 * Where the settlement stands.
 *
 * `paid` is checked before everything except applicability: once the shop has
 * confirmed, a missing screenshot must never reopen a settled bill. A customer
 * who ended up paying at the counter after all is simply paid.
 */
export function proofState(order: ProofableOrder): ProofState {
  // A claimed walk-in is the same bill as a booking: someone holds a phone
  // for it, and the same rails apply. Only a ticket with nobody behind it, or
  // a cancelled one, has nothing to settle here.
  if (order.customer_id === null || order.status === 'cancelled') {
    return 'not_applicable';
  }
  if (order.payment_status === 'paid') return 'confirmed';
  if (order.final_total === null) return 'awaiting_price';
  if (order.payment_method === 'cash') return 'awaiting_counter';
  if (order.payment_proof_path) return 'submitted';
  return 'awaiting_payment';
}

export interface CustomerProofCopy {
  title: string;
  body: string;
  /** Whether the upload control should be on screen at all. */
  canSubmit: boolean;
}

/** What the customer is told, and whether anything is being asked of them. */
export function customerProofCopy(
  state: ProofState,
  shopName: string
): CustomerProofCopy {
  switch (state) {
    case 'awaiting_price':
      return {
        title: 'Waiting for the actual price',
        body: `${shopName} will weigh your laundry and confirm what you owe.`,
        canSubmit: false,
      };
    case 'awaiting_counter':
      return {
        title: 'Pay at the shop',
        body: `Pay ${shopName} when you hand over or collect your laundry.`,
        canSubmit: false,
      };
    case 'awaiting_payment':
      return {
        title: 'Send your payment',
        body: 'Send the exact amount using the details below, then upload your receipt.',
        canSubmit: true,
      };
    case 'submitted':
      return {
        title: 'Receipt sent',
        // Never "payment received" — the app cannot see the shop's balance.
        body: `${shopName} is checking your receipt. This is usually quick.`,
        canSubmit: false,
      };
    case 'confirmed':
      return {
        title: 'Paid',
        body: `${shopName} confirmed your payment. Nothing left to settle.`,
        canSubmit: false,
      };
    case 'not_applicable':
      return { title: '', body: '', canSubmit: false };
  }
}

export interface MerchantProofCopy {
  title: string;
  body: string;
  canConfirm: boolean;
}

/** What the owner is told, and whether the settle button is live. */
export function merchantProofCopy(state: ProofState): MerchantProofCopy {
  switch (state) {
    case 'awaiting_price':
      return {
        title: 'Not weighed yet',
        body: 'Weigh the load to send the customer their actual price.',
        canConfirm: false,
      };
    case 'awaiting_counter':
      return {
        title: 'Paying cash',
        body: 'Settle this when the customer hands over or collects their laundry.',
        canConfirm: true,
      };
    case 'awaiting_payment':
      return {
        title: 'Waiting for payment',
        body: 'The customer has been sent your payment details.',
        canConfirm: false,
      };
    case 'submitted':
      return {
        title: 'Receipt to check',
        // The app records a claim; it cannot verify it. Saying so is the
        // difference between a record and a false assurance.
        body: 'Check this against your own GCash, Maya, or bank app before confirming.',
        canConfirm: true,
      };
    case 'confirmed':
      return { title: 'Paid', body: 'Settled in full.', canConfirm: false };
    case 'not_applicable':
      return { title: '', body: '', canConfirm: false };
  }
}

/**
 * A reference number as the customer copied it off their receipt.
 *
 * Spacing is kept, because that is how the number is printed and how the owner
 * will read it back against their transaction log. The character allowlist is
 * what keeps a pasted URL or a whole sentence out of a field somebody has to
 * match by eye.
 */
const REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{2,31}$/;

export function validateReference(input: string): string | null {
  const trimmed = input.trim();
  return REFERENCE_RE.test(trimmed) ? trimmed : null;
}
