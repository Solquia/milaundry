/**
 * One day's money, split the way the counter counts it: what actually came in
 * that day, and what that day's orders still owe.
 *
 * Laundry is often left unpaid until pickup, days later. Lumping it into the
 * day it was dropped off made a day look richer than the drawer; lumping it
 * into nothing hid it. So: **cash in** is money paid inside the day, whatever
 * day the order was taken; **to collect** is orders taken that day that are
 * still unpaid now. Once someone pays, their money moves to the day they paid.
 */
import { roundCentavos } from './money';
import type { OrderStatus } from './order-status';
import type { PaymentStatus } from './order-tags';
import type { PeriodFrame } from './sales-period';

export interface DayCashOrder {
  id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  estimated_total: number;
  final_total: number | null;
  paid_at: string | null;
  created_at: string;
}

export interface DayCash {
  /** Paid inside the day, whenever the order was taken. */
  cashIn: number;
  paidCount: number;
  /** Taken inside the day and still unpaid. */
  toCollect: number;
  unpaidCount: number;
}

type DayFrame = Pick<PeriodFrame, 'start' | 'cutoff'>;

const valueOf = (order: DayCashOrder): number => order.final_total ?? order.estimated_total;

const isInside = (iso: string | null, frame: DayFrame): boolean => {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return time >= frame.start && time < frame.cutoff;
};

const sum = (orders: readonly DayCashOrder[]): number =>
  roundCentavos(orders.reduce((total, order) => total + valueOf(order), 0));

export function dayCash(orders: readonly DayCashOrder[], frame: DayFrame): DayCash {
  const live = orders.filter((order) => order.status !== 'cancelled');
  const paid = live.filter(
    (order) => order.payment_status === 'paid' && isInside(order.paid_at, frame)
  );
  const unpaid = live.filter(
    (order) => order.payment_status !== 'paid' && isInside(order.created_at, frame)
  );
  return {
    cashIn: sum(paid),
    paidCount: paid.length,
    toCollect: sum(unpaid),
    unpaidCount: unpaid.length,
  };
}
