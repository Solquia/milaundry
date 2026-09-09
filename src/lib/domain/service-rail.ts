/**
 * The rail of categories beside the services, and what it says about itself.
 *
 * The web ordering step used to stack every category down one column, so a
 * shop with five of them was a long scroll and the price list was the only
 * thing on screen. A rail moves the categories to the side and shows one at a
 * time — which turns every category the customer is not looking at into a
 * closed door.
 *
 * That is the risk, and it is the same one the storefront accordion answers:
 * a door that hides what is behind it has hidden the reason to open it. So the
 * rail carries a count of the lines each category holds in the basket, and it
 * never opens on nothing.
 */

/** Just enough of a service for the rail to count it. */
interface RailService {
  id: string;
}

interface RailGroup<T extends RailService> {
  category: string;
  services: readonly T[];
}

/**
 * The category the grid should show.
 *
 * Falls back to the first rather than to nothing, because the grid is the
 * whole page: landing on an empty one reads as a shop with no prices. A
 * remembered category that no longer exists — the shop deleted its last dry
 * cleaning line while the page was open — falls back the same way.
 */
export function selectedRailCategory<T extends RailService>(
  groups: readonly RailGroup<T>[],
  current: string | null
): string | null {
  if (groups.length === 0) return null;
  const found = groups.some((group) => group.category === current);
  return found ? current : groups[0].category;
}

/**
 * How many lines of this category are in the basket.
 *
 * Lines, not units: eight kilos of wash-and-fold is one thing the customer
 * chose, and a rail badge reading "8" beside a category holding one service
 * would be a lie about how much is in there.
 */
export function railLineCount<T extends RailService>(
  cart: Readonly<Record<string, number>>,
  services: readonly T[]
): number {
  return services.filter((service) => (cart[service.id] ?? 0) > 0).length;
}
