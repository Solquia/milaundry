/**
 * The ping on the home screen.
 *
 * The bell already counts what needs doing, but a badge is a whisper. When a
 * shop has weighed a load and money is owed, the home screen itself should say
 * so — a card the customer walks into, not a dot they might notice.
 *
 * Derived from the same orders the bell derives from, through the same
 * `proofState` the pay screen uses, so the ping, the bell, and the screen it
 * links to can never disagree about whether anything is owed.
 */
import { formatMoney } from './money';
import type { OrderStatus } from './order-status';
import type { OrderType, PaymentStatus } from './order-tags';
import { proofState } from './payment-proof';
import type { PaymentMethod } from './walk-in-order';

export interface AttentionOrder {
  id: string;
  customer_id: string | null;
  /** Pre-resolved by the screen, so this module stays free of API shapes. */
  shopName: string;
  status: OrderStatus;
  order_type: OrderType;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  final_total: number | null;
  payment_proof_path: string | null;
  updated_at: string;
}

export type AttentionKind =
  /** Weighed, priced, and not yet settled: the customer owes money. */
  | 'pay'
  /** Receipt sent; the shop is checking. Nothing asked, worth knowing. */
  | 'checking';

export interface AttentionCard {
  orderId: string;
  kind: AttentionKind;
  /** The headline: the amount for a bill, the reassurance for a receipt. */
  title: string;
  body: string;
  /** Ionicons glyph. */
  icon: string;
}

function cardFor(order: AttentionOrder): AttentionCard | null {
  const state = proofState(order);

  switch (state) {
    case 'awaiting_payment':
      return {
        orderId: order.id,
        kind: 'pay',
        title: `${formatMoney(order.final_total ?? 0)} to pay`,
        body: `${order.shopName} weighed your laundry — see the photo and settle the bill.`,
        icon: 'cash-outline',
      };
    case 'awaiting_counter':
      return {
        orderId: order.id,
        kind: 'pay',
        title: `${formatMoney(order.final_total ?? 0)} to pay`,
        body: `Pay ${order.shopName} at the counter when you collect your laundry.`,
        icon: 'cash-outline',
      };
    case 'submitted':
      return {
        orderId: order.id,
        kind: 'checking',
        title: 'Receipt sent',
        body: `${order.shopName} is checking your receipt.`,
        icon: 'hourglass-outline',
      };
    default:
      return null;
  }
}

/**
 * What the home screen should press on the customer: bills first, newest
 * change first within a kind. A bill outranks a receipt-in-review for the same
 * reason the bell sorts actions first — owed money is a question, the rest is
 * news.
 */
export function homeAttention(orders: readonly AttentionOrder[]): AttentionCard[] {
  const dated = orders
    .map((order) => ({ card: cardFor(order), at: Date.parse(order.updated_at) }))
    .filter((entry): entry is { card: AttentionCard; at: number } => entry.card !== null);

  return dated
    .sort((a, b) => {
      if (a.card.kind !== b.card.kind) return a.card.kind === 'pay' ? -1 : 1;
      return b.at - a.at;
    })
    .map((entry) => entry.card);
}
