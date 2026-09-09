/**
 * One category of prices open at a time.
 *
 * A shop with a full price list ran to two or three screens of scrolling, and
 * every service was equally present whether or not the customer cared about it.
 * Collapsing to one open category turns that into a short menu of doors.
 *
 * The risk this carries is real and is answered next door: hiding prices behind
 * a tap is exactly what made the original icon grid impossible to choose from.
 * `categorySummaryLabel` is why the closed state is still a storefront — a
 * closed door that says "3 services · from ₱60" has not hidden the price, it
 * has summarised it.
 */
import { formatMoneyCompact } from './money';
import { startingPrice, type PricedService } from './storefront';

/**
 * The category that should be open after a tap.
 *
 * Tapping the open one closes it. Without that, the only way to collapse a
 * section is to open a different one, and the header feels broken the first
 * time somebody tries.
 */
export function nextOpenCategory(current: string | null, tapped: string): string | null {
  return current === tapped ? null : tapped;
}

/**
 * What a closed category says about itself: how much is inside, and the
 * cheapest way in.
 *
 * The price is dropped rather than shown as ₱0 when nothing in the category is
 * usefully priced — a free category and a category with no usable price are
 * different things, and neither is a sales pitch.
 */
export function categorySummaryLabel(services: readonly PricedService[]): string {
  if (services.length === 0) return '';

  const count = `${services.length} ${services.length === 1 ? 'service' : 'services'}`;
  const cheapest = startingPrice(services);
  if (cheapest === null) return count;

  return `${count} · from ${formatMoneyCompact(cheapest)}`;
}
