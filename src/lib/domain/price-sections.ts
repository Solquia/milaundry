/**
 * What a closed section of the owner's price list says about itself.
 *
 * The merchant Prices screen printed every service in every category, always
 * open, with the "Add something you offer" form stranded at the bottom of that
 * scroll. Collapsing each category turns the screen into a short index of the
 * shop's own sections — but a closed door is only acceptable if it still
 * answers the question the owner opened the screen with.
 *
 * That question is not the customer's. The storefront's `categorySummaryLabel`
 * next door quotes "from ₱60", because a customer is shopping for the cheapest
 * way in. An owner is auditing: how many prices are in here, and what is the
 * spread I charge. So this counts and gives the range, and it deliberately
 * keeps the count when no price is usable — a section of ₱0 services is a
 * mistake to go and find, not a section to go quiet about.
 *
 * The open/close rule itself is shared with the storefront accordion; see
 * `nextOpenCategory` in `price-accordion.ts`.
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
 * The category name shown on the closed picker in the add-service form.
 *
 * Six chips wrapped to three rows there, with the chosen one liable to sit
 * alone on the last row where it read as a separate control. Closed, the
 * picker has one job: say which category the new service is going into.
 */
export function selectedCategoryLabel(category: ServiceCategory): string {
  return CATEGORY_LABELS[category];
}
