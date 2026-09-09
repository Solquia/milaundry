/**
 * The moment the price stops being a guess.
 *
 * A booking is priced from a weight the customer estimated in their kitchen.
 * The shop then puts the same load on a scale, and that reading is what the
 * customer actually owes. Until now the app had no way to record it: the only
 * function that touched `final_total` copied the estimate across, so the
 * "Actual total" `actual-bill.ts` renders could never differ from the guess.
 *
 * This module is the arithmetic behind that correction. It re-prices only the
 * line that was weighed — the extras a customer deliberately chose are theirs,
 * not the scale's — and states the difference in words, because a price that
 * moves without explanation is what makes someone stop trusting the app.
 */
import { formatMoney, roundCentavos } from './money';
import type { OrderStatus } from './order-status';
import type { PaymentStatus } from './order-tags';
import type { PricingUnit } from './pricing';

/**
 * Past this, a reading is a slipped decimal point rather than a laundry load —
 * 705 typed for 70.5. Deliberately far above `MAX_WEIGHT_KG`, the 30 kg ceiling
 * the *booking* form imposes: a shop may legitimately weigh more than a
 * customer was allowed to book, and rejecting that would block real work.
 */
export const MAX_SCALE_KG = 100;

export interface WeighLine {
  serviceId: string;
  serviceName: string;
  unit: PricingUnit;
  unitPrice: number;
  /** Minimum billable quantity. 0 means no minimum. */
  minQuantity: number;
  /** Quantity as booked. Replaced by the scale reading on the weighed line. */
  quantity: number;
}

export interface WeighedLine extends WeighLine {
  subtotal: number;
  /** True for the one line the scale reading was applied to. */
  isWeighed: boolean;
}

export interface WeighedBill {
  lines: WeighedLine[];
  total: number;
  /** True when the load came in under the shop's minimum and was billed up. */
  isAtMinimum: boolean;
}

/**
 * A scale reading as the owner types it. Tolerates the trailing unit, because
 * that is what is printed on the display they are copying from. Anything that
 * is not a positive weight returns null so the caller can say so, rather than
 * being silently treated as zero and billing the customer nothing.
 */
export function parseWeight(input: string): number | null {
  const cleaned = input.replace(/\s*kgs?\.?\s*$/i, '').trim();
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;

  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0 || value > MAX_SCALE_KG) return null;
  return value;
}

function subtotalFor(line: WeighLine, quantity: number): number {
  if (line.unit === 'flat') return roundCentavos(line.unitPrice);
  const billable = Math.max(quantity, line.minQuantity ?? 0);
  return roundCentavos(line.unitPrice * billable);
}

/**
 * The bill as the scale makes it.
 *
 * Only `weighedServiceId` takes the reading. A comforter the customer added by
 * hand keeps the quantity they chose — re-pricing it from a kilo count would
 * be editing their order behind their back.
 *
 * The returned figure is advisory in exactly the way the booking estimate is:
 * `weigh_order` recomputes it server-side from the `services` table, and that
 * answer is the one that reaches the customer.
 */
export function recomputeForWeight(
  lines: readonly WeighLine[],
  weighedServiceId: string,
  weightKg: number
): WeighedBill {
  const target = lines.find((line) => line.serviceId === weighedServiceId);
  if (!target) throw new Error(`Unknown service: ${weighedServiceId}`);
  if (target.unit !== 'per_kg') {
    throw new Error(`${target.serviceName} is not sold by weight`);
  }

  const priced = lines.map((line): WeighedLine => {
    const isWeighed = line.serviceId === weighedServiceId;
    const quantity = isWeighed ? weightKg : line.quantity;
    return { ...line, quantity, subtotal: subtotalFor(line, quantity), isWeighed };
  });

  return {
    lines: priced,
    total: roundCentavos(priced.reduce((sum, line) => sum + line.subtotal, 0)),
    isAtMinimum: weightKg < (target.minQuantity ?? 0),
  };
}

/**
 * How the weighing moved the price, for the owner about to commit it.
 *
 * `actual-bill.ts` says the same thing to the customer. This one adds the
 * sentence that matters at the counter: the number is about to leave the shop.
 */
export function describeWeighChange(estimated: number, actual: number): string | null {
  const delta = roundCentavos(actual - estimated);
  if (delta === 0) return null;

  const direction = delta > 0 ? 'more' : 'less';
  return `${formatMoney(Math.abs(delta))} ${direction} than the ${formatMoney(
    estimated
  )} estimate. The customer will see this.`;
}

export interface WeighableOrder {
  status: OrderStatus;
  payment_status: PaymentStatus;
  final_total: number | null;
}

/** Statuses where the laundry is not yet the shop's to put on a scale. */
const NOT_YET_IN_HAND: readonly OrderStatus[] = ['pending'];
const OVER: readonly OrderStatus[] = ['completed', 'cancelled'];

/**
 * Whether the shop may set — or correct — the actual price.
 *
 * Re-weighing an unpaid order is a fix, so it stays open. Re-weighing a *paid*
 * one would be raising a bill after it was settled, which is the one thing this
 * guard exists to prevent. `weigh_order` enforces the same rule server-side;
 * this is the copy that greys out the button.
 */
export function canWeigh(order: WeighableOrder): boolean {
  if (order.payment_status === 'paid') return false;
  if (OVER.includes(order.status)) return false;
  return !NOT_YET_IN_HAND.includes(order.status);
}
