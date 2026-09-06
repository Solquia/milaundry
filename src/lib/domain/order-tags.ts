import type { OrderStatus } from './order-status';
import type { Fulfillment } from './walk-in-order';

export type OrderType = 'walk_in' | 'online';
export type PaymentStatus = 'unpaid' | 'paid';

export interface TaggableOrder {
  order_type: OrderType;
  fulfillment: Fulfillment;
  payment_status: PaymentStatus;
  status: OrderStatus;
  /** The account holding the order; null for an unclaimed walk-in. */
  customer_id: string | null;
  /** The receipt the customer sent, if any; null until they do. */
  payment_proof_path: string | null;
}

/**
 * The one tag that means money is still owed. Exported so `Tag` can style it
 * as an alert without a bare string comparison — renaming the label here must
 * not silently drop the amber treatment.
 */
export const UNPAID_TAG = 'Unpaid';

/** Its settled counterpart, styled quietly positive rather than neutral. */
export const PAID_TAG = 'Paid';

/**
 * A walk-in ticket that a customer has scanned into their account. Only a
 * walk-in can earn it: an online order has an account from the first second,
 * and "Online" already says so.
 */
export const CLAIMED_TAG = 'Claimed';

/**
 * The customer says they have paid, and the shop has not yet checked. It takes
 * Unpaid's place, because Unpaid is no longer what the counter should do next:
 * the instruction now is to look at the receipt and start the wash.
 */
export const RECEIPT_TAG = 'Receipt sent';

/** True when a walk-in ticket now has an account behind it. */
export function isClaimedWalkIn(order: Pick<TaggableOrder, 'order_type' | 'customer_id'>): boolean {
  return order.order_type === 'walk_in' && order.customer_id !== null;
}

/** Display tags for an order card: origin, fulfillment, and payment state. */
export function orderTags(order: TaggableOrder): string[] {
  const tags = [order.order_type === 'walk_in' ? 'Walk-in' : 'Online'];
  if (isClaimedWalkIn(order)) tags.push(CLAIMED_TAG);
  tags.push(order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup');
  if (order.status !== 'cancelled') {
    if (order.payment_status === 'paid') tags.push(PAID_TAG);
    else tags.push(order.payment_proof_path ? RECEIPT_TAG : UNPAID_TAG);
  }
  return tags;
}
