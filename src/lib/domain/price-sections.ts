/**
 * What a section of the owner's price list says about itself.
 *
 * Each category on the merchant Prices screen is headed by a one-line audit of
 * what it holds, beside the rows themselves.
 *
 * That question is not the customer's. The storefront's `categorySummaryLabel`
 * next door quotes "from ₱60", because a customer is shopping for the cheapest
 * way in. An owner is auditing: how many prices are in here, and what is the
 * spread I charge. So this counts and gives the range, and it deliberately
 * keeps the count when no price is usable — a section of ₱0 services is a
 * mistake to go and find, not a section to go quiet about.
 */
import { formatMoneyCompact } from './money';
import { CATEGORY_LABELS, type ServiceCategory } from './service-catalog';

export interface PricedEntry {
  price: number;
}

/** A price the shop actually charges, as opposed to an unfinished row. */
function isCharged(price: number): boolean {
  return Number.isFinite(price) && price > 0;
}

/**
 * `3 prices · ₱35–₱180` — how much is inside a collapsed category and the
 * spread it covers.
 *
 * The range collapses to one figure when the ends meet, because "₱75–₱75"
 * reads as a control that has failed rather than as a shop with one price.
 */
export function categoryPriceSummary(services: readonly PricedEntry[]): string {
  if (services.length === 0) return '';

  const count = `${services.length} ${services.length === 1 ? 'price' : 'prices'}`;
  const charged = services.map((service) => service.price).filter(isCharged);
  if (charged.length === 0) return count;

  const low = formatMoneyCompact(Math.min(...charged));
  const high = formatMoneyCompact(Math.max(...charged));
  return low === high ? `${count} · ${low}` : `${count} · ${low}–${high}`;
}

/**
 * The warning above the price list while any service is still ₱0, or null.
 *
 * `categoryPriceSummary` keeps the count of such a section but drops the
 * amount, and a missing figure is the least noticeable thing on a screen. A
 * ₱0 service is either free to the customer or unfinished; either way the
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
