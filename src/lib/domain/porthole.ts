/**
 * How full a service's porthole is.
 *
 * Every service on the shelf and the till sits behind a washer door, and the
 * door always holds a little water — that is what makes it read as a machine
 * rather than as a circle with a drawing in it. On the till the water rises as
 * the counter loads the ticket: a heavier load or another piece lifts the line,
 * so a glance across the grid says which tiles are carrying the order and
 * roughly how much. The level is a picture, never a figure; the count on the
 * door says the number.
 */
import type { PricingUnit } from './pricing';

/** The line a door sits at with nothing on the ticket. */
export const PORTHOLE_IDLE = 0.26;
/** The highest the water goes: over this the object drowns and stops reading. */
export const PORTHOLE_FULL = 0.68;

/** A kilogram lifts the line this much, so a 3 kg load and a 10 kg load differ. */
const PER_KG = 0.035;
/** Each piece lifts it this much. */
const PER_PIECE = 0.06;
/** A flat service is on or off, so it fills once, halfway. */
const FLAT_LEVEL = 0.46;
/** The first unit of anything clears the idle line visibly, not by a hair. */
const FIRST_LIFT = 0.1;

export function portholeLevel(unit: PricingUnit, quantity: number | undefined): number {
  if (quantity === undefined || !Number.isFinite(quantity) || quantity <= 0) {
    return PORTHOLE_IDLE;
  }
  if (unit === 'flat') return FLAT_LEVEL;
  const step = unit === 'per_kg' ? PER_KG : PER_PIECE;
  return Math.min(PORTHOLE_FULL, PORTHOLE_IDLE + FIRST_LIFT + step * quantity);
}
