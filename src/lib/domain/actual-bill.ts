/**
 * The bill as the customer meets it.
 *
 * A booking is priced twice: once as an estimate from the quantities the
 * customer guessed at, and once for real after the shop puts the load on the
 * scale. The screen used to show one figure with a parenthetical "(estimated)",
 * which meant the moment the number changed — the moment money is actually
 * being asked for — looked like nothing had happened.
 *
 * This says which of the two figures is on screen, and when the real one
 * arrives, how it differs from the estimate. A price that moves without
 * explanation is the thing that makes someone stop trusting the app.
 */
import { formatMoney, roundCentavos } from './money';
import type { OrderStatus } from './order-status';
import type { PaymentStatus } from './order-tags';
import type { Fulfillment } from './walk-in-order';

export interface BillableOrder {
  estimated_total: number;
  /** null until the shop has weighed the laundry. */
  final_total: number | null;
  payment_status: PaymentStatus;
  status: OrderStatus;
  fulfillment: Fulfillment;
}

export type BillStage = 'estimated' | 'weighed' | 'settled';

export interface ActualBill {
  stage: BillStage;
  /** Names the figure, so it is never ambiguous which of the two is shown. */
  heading: string;
  amount: string;
  /** What happens next with the money. */
  note: string;
  /** How the weighing moved the price; null when there is nothing to report. */
  difference: string | null;
  /** Whether a payment method may be chosen yet. */
  isPayable: boolean;
}

const HEADINGS: Record<BillStage, string> = {
  estimated: 'Estimated total',
  weighed: 'Actual total',
  settled: 'Paid in full',
};

function differenceLine(estimated: number, final: number): string | null {
  const delta = roundCentavos(final - estimated);
  if (delta === 0) return null;

  const direction = delta > 0 ? 'more' : 'less';
  return `${formatMoney(Math.abs(delta))} ${direction} than the ${formatMoney(
    estimated
  )} estimate`;
}

function note(order: BillableOrder, stage: BillStage): string {
  if (order.status === 'cancelled') return 'This order was cancelled.';
  if (stage === 'settled') return 'Settled in full — nothing left to pay.';
  if (stage === 'estimated') {
    // The heading directly above already says "Estimated total", so the note
    // opened by agreeing with it. What the customer does not yet know is who
    // resolves the number and when — that is what the sentence is for.
    return 'The shop will weigh your laundry and confirm the price before you pay.';
  }
  return order.fulfillment === 'delivery'
    ? 'Pay when your laundry is delivered, or settle it with the shop now.'
    : 'Pay when you pick your laundry up, or settle it with the shop now.';
}

export function actualBill(order: BillableOrder): ActualBill {
  const isWeighed = order.final_total !== null;
  const isPaid = order.payment_status === 'paid';
  const stage: BillStage = isPaid ? 'settled' : isWeighed ? 'weighed' : 'estimated';

  return {
    stage,
    heading: HEADINGS[stage],
    amount: formatMoney(order.final_total ?? order.estimated_total),
    note: note(order, stage),
    difference: isWeighed
      ? differenceLine(order.estimated_total, order.final_total as number)
      : null,
    isPayable: isWeighed && !isPaid && order.status !== 'cancelled',
  };
}
