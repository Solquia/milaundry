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

/** How a category's services should be put on screen. */
export type CategoryPresentation = 'measure' | 'choose';

/**
 * Whether the grid should ask *which* or *how much*.
 *
 * A picture earns its place when it is the thing being chosen between. A
 * category holding one service has nothing to choose, so its photograph is
 * decoration, and the question that actually remains — how many kilos, how
 * many pieces — was being left to a stepper the width of a thumbnail.
 *
 * With one service the grid gives that question the whole width and uses the
 * app's own scale and piece pickers. With two or more the pictures come back,
 * because then they are the choice.
 */
export function categoryPresentation(serviceCount: number): CategoryPresentation {
  return serviceCount === 1 ? 'measure' : 'choose';
}

/**
 * Which service the controls should be set to, given the open category and
 * whatever was picked last.
 *
 * A list of one is not a choice, so a category holding a single service picks
 * it outright — making the customer tap it before the scale appears is a step
 * that exists only because the code has a slot for it.
 *
 * A pick belonging to a category that is no longer open is dropped rather than
 * carried, or opening Bedding would leave the controls set to a wash-and-fold
 * the list beside them is no longer showing.
 */
export function resolvePick<T extends RailService>(
  group: RailGroup<T> | undefined,
  picked: string | null
): string | null {
  if (!group) return null;
  if (group.services.some((service) => service.id === picked)) return picked;
  return group.services.length === 1 ? group.services[0].id : null;
}
