import type { OrderStatus } from './order-status';
import type { PaymentStatus } from './order-tags';

export interface AnalyticsOrder {
  status: OrderStatus;
  payment_status: PaymentStatus;
  estimated_total: number;
  final_total: number | null;
  paid_at: string | null;
  created_at: string;
}

export interface DailyMoney {
  /** Payments received today (orders with paid_at today). */
  collectedToday: number;
  /** Collected today + value of today's unpaid, non-cancelled orders. */
  projectedToday: number;
  /** Everything customers still owe (unpaid, non-cancelled, any date). */
  receivables: number;
  /** Orders created today, excluding cancelled ones. */
  ordersToday: number;
  /**
   * Payments received today, excluding cancelled orders. Counted separately
   * from `ordersToday` because the two key off different timestamps: an order
   * taken yesterday and paid this morning is a payment today and an order
   * yesterday. The screen shows both so the pair never reads as a
   * contradiction.
   */
  paymentsToday: number;
}

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const orderValue = (order: AnalyticsOrder): number =>
  order.final_total ?? order.estimated_total;

function isSameLocalDay(iso: string | null, reference: Date): boolean {
  if (!iso) return false;
  const date = new Date(iso);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
}

export function computeDailyMoney(
  orders: readonly AnalyticsOrder[],
  now: Date
): DailyMoney {
  let collectedToday = 0;
  let outstandingToday = 0;
  let receivables = 0;
  let ordersToday = 0;
  let paymentsToday = 0;

  for (const order of orders) {
    const isCancelled = order.status === 'cancelled';
    const isPaid = order.payment_status === 'paid';

    // Cancelled orders never count as collected, even if paid before voiding.
    if (!isCancelled && isPaid && isSameLocalDay(order.paid_at, now)) {
      collectedToday += orderValue(order);
      paymentsToday += 1;
    }
    if (!isCancelled && !isPaid) {
      receivables += orderValue(order);
      if (isSameLocalDay(order.created_at, now)) {
        outstandingToday += orderValue(order);
      }
    }
    if (!isCancelled && isSameLocalDay(order.created_at, now)) {
      ordersToday += 1;
    }
  }

  return {
    collectedToday: roundMoney(collectedToday),
    projectedToday: roundMoney(collectedToday + outstandingToday),
    receivables: roundMoney(receivables),
    ordersToday,
    paymentsToday,
  };
}
