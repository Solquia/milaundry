/**
 * What the owner's Prices screen says about the list as a whole.
 *
 * The list shows every price in full, so it needs no per-section summary;
 * what it needs are words for the two things a list of figures cannot say on
 * its own: that something is still ₱0, and that the last change landed.
 */
import { CATEGORY_LABELS, type ServiceCategory } from './service-catalog';

export interface PricedEntry {
  price: number;
}

/** A price the shop actually charges, as opposed to an unfinished row. */
function isCharged(price: number): boolean {
  return Number.isFinite(price) && price > 0;
}

/**
 * The warning above the price list while any service is still ₱0, or null.
 *
 * A ₱0 row shows no figure, and a missing figure is the least noticeable
 * thing on a screen. A ₱0 service is either free to the customer or unfinished; either way the
 * owner should be told in words.
 */
export function unpricedNotice(services: readonly PricedEntry[]): string | null {
  const count = services.filter((service) => !isCharged(service.price)).length;
  if (count === 0) return null;
  if (count === 1) return '1 price is ₱0, so customers see it as free. Tap it to set a price.';
  return `${count} prices are ₱0, so customers see them as free. Tap each to set a price.`;
}

/**
 * What the price list says after the form closes. Adding used to fold the form
 * away into a list whose sections were closed, so the only sign a service had
 * landed was a count going up by one.
 */
export function savedNotice(outcome: {
  name: string;
  category: ServiceCategory;
  verb: 'added' | 'saved' | 'removed';
}): string {
  if (outcome.verb === 'added') return `${outcome.name} added to ${CATEGORY_LABELS[outcome.category]}.`;
  if (outcome.verb === 'removed') return `${outcome.name} removed from your price list.`;
  return `${outcome.name} saved.`;
}
