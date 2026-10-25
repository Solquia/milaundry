/**
 * One day's money, split the way the counter counts it: what actually came in
 * that day, and what that day's orders still owe.
 *
 * Laundry is often left unpaid until pickup, days later. Lumping it into the
 * day it was dropped off made a day look richer than the drawer; lumping it
 * into nothing hid it. So: **cash in** is money paid inside the day, whatever
 * day the order was taken; **to collect** is orders taken that day that are
 * still unpaid now. Once someone pays, their money moves to the day they paid.
 * A part payment is money paid too: it counts on its own day, and only the
 * balance is left to collect (see `part-payments`).
 */
import { roundCentavos } from './money';
import type { OrderStatus } from './order-status';
import { balanceOf, moneyIn, type PayableOrder } from './part-payments';
import type { PeriodFrame } from './sales-period';

export interface DayCashOrder extends PayableOrder {
  id: string;
  status: OrderStatus;
  created_at: string;
}

export interface DayCash {
  /** Paid inside the day, whenever the order was taken. */
  cashIn: number;
  /** Payments taken inside the day, parts included. */
  paidCount: number;
  /** Taken inside the day and still owed. */
  toCollect: number;
  unpaidCount: number;
}

type DayFrame = Pick<PeriodFrame, 'start' | 'cutoff'>;

const isInside = (iso: string | null, frame: DayFrame): boolean => {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return time >= frame.start && time < frame.cutoff;
};

export function dayCash(orders: readonly DayCashOrder[], frame: DayFrame): DayCash {
  const live = orders.filter((order) => order.status !== 'cancelled');
  const payments = live.flatMap(moneyIn).filter((payment) => isInside(payment.at, frame));
  const unpaid = live.filter(
    (order) => order.payment_status !== 'paid' && isInside(order.created_at, frame)
  );
  return {
    cashIn: roundCentavos(payments.reduce((total, payment) => total + payment.amount, 0)),
    paidCount: payments.length,
    toCollect: roundCentavos(unpaid.reduce((total, order) => total + balanceOf(order), 0)),
    unpaidCount: unpaid.length,
  };
}
