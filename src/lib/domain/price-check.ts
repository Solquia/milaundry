/**
 * The counter's check of a booking against what actually came through the door.
 *
 * `weigh-order.ts` could only correct a line sold by the kilo, so a booking of
 * flat-priced items — a comforter, bedsheets, a scoop of detergent — could
 * never be given an actual price, and without one the customer could never
 * pay online. Every line is checked here: a weighed line takes the scale's
 * reading, a counted line takes the number of pieces in the bag, and a piece
 * the customer booked but did not bring comes off the bill.
 *
 * Lines keep the price the customer booked at; only the quantity is the
 * counter's to change. `confirm_order_price` does the same arithmetic on the
 * server, which is the figure that counts.
 */
import { roundCentavos } from './money';
import type { PricingUnit } from './pricing';
import { MAX_SCALE_KG } from './weigh-order';

/** Past this a count is a slipped key, not a bag of laundry. */
export const MAX_PIECES = 500;

export interface CheckLine {
  itemId: string;
  name: string;
  unit: PricingUnit;
  /** What the customer booked it at. */
  unitPrice: number;
  /** Billable floor for a weighed line; 0 for none. */
  minQuantity: number;
  bookedQuantity: number;
}

/** item id → the quantity the counter set; absent means "as booked". */
export type CheckQuantities = Readonly<Record<string, number>>;

export function checkLineSubtotal(line: CheckLine, quantity: number): number {
  const billable = line.unit === 'per_kg' ? Math.max(quantity, line.minQuantity) : quantity;
  return roundCentavos(line.unitPrice * billable);
}

export function quantityFor(line: CheckLine, quantities: CheckQuantities): number {
  return quantities[line.itemId] ?? line.bookedQuantity;
}

export function checkTotal(lines: readonly CheckLine[], quantities: CheckQuantities): number {
  return roundCentavos(
    lines.reduce((sum, line) => sum + checkLineSubtotal(line, quantityFor(line, quantities)), 0)
  );
}

/** Why a quantity cannot be sent, or null when it can. */
export function quantityError(line: CheckLine, quantity: number): string | null {
  if (!Number.isFinite(quantity)) return `Enter a number for ${line.name}.`;
  if (line.unit === 'per_kg') {
    if (quantity <= 0) return `Enter the weight the scale shows for ${line.name}.`;
    if (quantity > MAX_SCALE_KG) return `${line.name}: more than ${MAX_SCALE_KG} kg looks like a typo.`;
    return null;
  }
  if (!Number.isInteger(quantity)) return `${line.name} is counted in whole pieces.`;
  if (quantity < 0 || quantity > MAX_PIECES) return `${line.name}: enter 0 to ${MAX_PIECES} pieces.`;
  return null;
}
