/**
 * Thick and heavy extras on a booking: comforters, curtains, big beddings.
 *
 * Each extra used to carry its own readout ("0 pieces", 64pt) and its own
 * rail of count pills, so two extras filled a phone screen before anyone had
 * one. Most customers add none, and the rest add one or two, so an extra is
 * now a single row with − and +. What that row says is decided here.
 */
import { MAX_WEIGHT_KG } from './booking-estimate';
import { formatMoneyCompact } from './money';
import { formatQuantity } from './price-label';
import { estimateLineTotal, type PricingUnit, type Service } from './pricing';
import { MAX_PIECES } from './quantity-input';

/** The most one tap of + can reach for this unit. A flat extra is on or off. */
export function extraLimit(unit: PricingUnit): number {
  if (unit === 'flat') return 1;
  return unit === 'per_kg' ? MAX_WEIGHT_KG : MAX_PIECES;
}

/**
 * One tap of − or +. Whole kilos and whole pieces: a stepper that moves in
 * halves makes the customer tap twice for every kilo they meant.
 */
export function stepExtra(unit: PricingUnit, quantity: number, direction: 1 | -1): number {
  const current = Number.isFinite(quantity) ? quantity : 0;
  const next = direction === 1 ? Math.floor(current) + 1 : Math.ceil(current) - 1;
  return Math.min(extraLimit(unit), Math.max(0, next));
}

const RATE_WORDS: Record<PricingUnit, string> = {
  per_item: 'per piece',
  per_kg: 'per kg',
  flat: 'flat',
};

/**
 * The line under the name: the rate until something is added, then what the
 * added amount costs. The cost is the billed line, so a minimum shows up as
 * the figure that will be charged rather than as quantity times rate.
 */
export function extraPriceCaption(service: Service, quantity: number): string {
  if (!(quantity > 0)) return `${formatMoneyCompact(service.price)} ${RATE_WORDS[service.unit]}`;
  const total = formatMoneyCompact(estimateLineTotal(service, quantity));
  return `${total} for ${formatQuantity(service.unit, quantity)}`;
}
