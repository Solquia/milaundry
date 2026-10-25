/**
 * Money that came in before the bill was settled.
 *
 * A customer can hand over ₱100 of a ₱165 bill today and the ₱65 at pickup.
 * The order stays unpaid until the last peso, but the ₱100 is real money in
 * the drawer today, and staff remit the day's takings to the owner that
 * evening. So every figure that counts money in asks this module for an
 * order's payments rather than reading `paid_at` alone: each part on its own
 * day, then the remainder on the day it was settled (see migration 0056).
 */
import { roundCentavos } from './money';
import type { PaymentStatus } from './order-tags';
import type { PaymentMethod } from './walk-in-order';

export interface PartPayment {
  amount: number;
  /** ISO-8601, stamped by the server. */
  at: string;
  method: PaymentMethod;
}

export interface PayableOrder {
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  estimated_total: number;
  final_total: number | null;
  paid_at: string | null;
  /** Optional until every caller's rows come from 0056 onwards. */
  part_payments?: readonly PartPayment[] | null;
}

/** One sum of money arriving, part or final. */
export interface MoneyIn {
  amount: number;
  at: string;
  method: PaymentMethod;
  isPart: boolean;
}

const billOf = (order: PayableOrder): number => order.final_total ?? order.estimated_total;

export function partsOf(order: Pick<PayableOrder, 'part_payments'>): readonly PartPayment[] {
  return order.part_payments ?? [];
}

/** Paid so far in parts; 0 for an order paid in one go. */
export function paidInParts(order: Pick<PayableOrder, 'part_payments'>): number {
  return roundCentavos(partsOf(order).reduce((sum, part) => sum + Number(part.amount), 0));
}

/** What the customer still owes: nothing once paid, else the bill less the parts. */
export function balanceOf(order: PayableOrder): number {
  if (order.payment_status === 'paid') return 0;
  return roundCentavos(Math.max(0, billOf(order) - paidInParts(order)));
}

/** Every payment on the order, oldest first: the parts, then the settling one. */
export function moneyIn(order: PayableOrder): MoneyIn[] {
  const parts = partsOf(order).map(
    (part): MoneyIn => ({ amount: Number(part.amount), at: part.at, method: part.method, isPart: true })
  );
  if (order.payment_status !== 'paid' || !order.paid_at) return parts;
  // Parts were checked against the bill when taken; a later re-weigh that
  // lowered it must not turn the settling payment negative.
  const rest = roundCentavos(Math.max(0, billOf(order) - paidInParts(order)));
  const settle: MoneyIn = { amount: rest, at: order.paid_at, method: order.payment_method, isPart: false };
  return parts.length > 0 && rest === 0 ? parts : [...parts, settle];
}
