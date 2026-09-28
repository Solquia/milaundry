/**
 * What the money on an order is waiting for, from the counter's side.
 *
 * The order screen used to show ₱435 in amber — "to collect" — beside an
 * Unpaid tag the moment a booking landed, when the figure was the customer's
 * kitchen guess and nobody could pay it: the app keeps online payment shut
 * until the shop weighs the load and sends the real price (`payment-proof.ts`).
 * The screen never said so, and the weighing that unlocks everything sat five
 * cards down under a footer offering "Start washing" instead.
 *
 * This names the one step the money is on, so the hero, the footer and the
 * payment card can all say the same thing.
 */
import type { OrderStatus } from './order-status';
import type { OrderType, PaymentStatus } from './order-tags';
import { proofState } from './payment-proof';
import type { PricingUnit } from './pricing';
import type { PaymentMethod } from './walk-in-order';

export type SettleStep =
  /** Booked; the laundry is not in the shop yet, so there is nothing to check. */
  | 'receive'
  /** In the shop, and the actual price — by weight or by the piece — has not been sent. */
  | 'confirm_price'
  /** Price sent; the customer pays online next. */
  | 'await_customer'
  /** The customer sent a receipt; the shop checks its own wallet. */
  | 'check_receipt'
  /** Paid across the counter: cash, or a walk-in nobody holds a phone for. */
  | 'collect'
  | 'settled'
  | 'void';

export interface SettleableOrder {
  order_type: OrderType;
  customer_id: string | null;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  final_total: number | null;
  payment_proof_path: string | null;
  order_items: readonly { unit: PricingUnit }[];
}

export function isSoldByWeight(order: Pick<SettleableOrder, 'order_items'>): boolean {
  return order.order_items.some((item) => item.unit === 'per_kg');
}

/**
 * Whether a real price has to be confirmed before anyone can pay. A load sold
 * by weight always does; an online booking always does, even by the piece,
 * because the customer counted it at home and the shop counts it at the
 * counter. A walk-in by the piece was counted in front of the customer.
 */
function needsPriceCheck(order: SettleableOrder): boolean {
  return isSoldByWeight(order) || order.order_type === 'online';
}

export function settleStep(order: SettleableOrder): SettleStep {
  if (order.status === 'cancelled') return 'void';
  if (order.payment_status === 'paid') return 'settled';
  if (order.final_total === null && needsPriceCheck(order)) {
    return order.status === 'pending' ? 'receive' : 'confirm_price';
  }
  const proof = proofState(order);
  if (proof === 'submitted') return 'check_receipt';
  if (proof === 'awaiting_payment') return 'await_customer';
  return 'collect';
}

/**
 * Whether an online order must stay out of the machines.
 *
 * The shop confirms the actual price, the customer pays online and sends the
 * receipt, the shop confirms the money — and only then does the load go in.
 * A customer paying cash on delivery is trusted once the price is agreed. A
 * walk-in is never held: the customer was at the counter for all of it.
 * `update_order_status` refuses the same move on the server.
 */
export function isHeldForPayment(order: SettleableOrder): boolean {
  if (order.order_type !== 'online' || order.status === 'pending') return false;
  const step = settleStep(order);
  if (step === 'confirm_price') return true;
  return step === 'await_customer' || step === 'check_receipt';
}

export interface AmountNote {
  text: string;
  /** Amber only when a real figure is actually owed — never for a guess. */
  isOwed: boolean;
}

const NOTES: Record<SettleStep, string> = {
  receive: 'Estimate · check on arrival',
  confirm_price: 'Estimate · confirm the actual price',
  await_customer: 'Final · customer to pay',
  check_receipt: 'Final · receipt to check',
  collect: 'Final · to collect',
  settled: 'Final · paid',
  void: 'Cancelled',
};

export function settleAmountNote(order: SettleableOrder): AmountNote {
  const step = settleStep(order);
  const isEstimate = order.final_total === null;
  // A per-piece order has no scale step; its booked price is the price.
  const text = step === 'collect' && isEstimate ? 'Estimate · to collect' : NOTES[step];
  const isOwed = step === 'await_customer' || step === 'check_receipt' || step === 'collect';
  return { text, isOwed };
}
