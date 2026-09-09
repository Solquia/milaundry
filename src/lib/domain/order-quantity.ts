/**
 * Bounds for the POS quantity steppers.
 *
 * The steppers used to be unbounded: fifty taps produced a 25 kg load with no
 * sanity check, and repeated 0.5 steps accumulated float error that surfaced
 * on the card as "2.9000000000000004 kg". Both are clamped here so every
 * screen shares one rule.
 */
import type { PricingUnit } from './pricing';

/** No counter scale in a neighbourhood laundry weighs a single load past this. */
export const MAX_WEIGHED_QUANTITY = 100;
/** Counted items stay two digits; past that it is a wholesale job, not a walk-in. */
export const MAX_COUNTED_QUANTITY = 99;

export function quantityCeiling(unit: PricingUnit): number {
  if (unit === 'per_kg') return MAX_WEIGHED_QUANTITY;
  if (unit === 'per_item') return MAX_COUNTED_QUANTITY;
  // A flat service is billed once no matter how many times it is added.
  return 1;
}

/**
 * Apply one stepper press, clamped to `[0, max]` and rounded to a tenth so
 * half-kilo steps stay readable.
 */
export function adjustQuantity(current: number, step: number, max: number): number {
  const base = Number.isFinite(current) ? current : 0;
  const next = Math.round((base + step) * 10) / 10;
  return Math.min(max, Math.max(0, next));
}
