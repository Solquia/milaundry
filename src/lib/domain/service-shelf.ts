/**
 * The shelf: how a service presents itself when a customer is browsing.
 *
 * The price list used to be a grid of coloured boxes whose only structure was
 * a category chip and a large figure. A customer standing over it with a bag
 * of laundry asks two things in this order — "what is this one" and "what does
 * it cost me" — and the grid answered the second first, in the largest type on
 * the card, because the card was built as a price list rather than as a shelf.
 *
 * A shelf leads with the thing, states the rate quietly above the name, and
 * puts the shop's own rule in the corner where a shelf label goes. What goes
 * in that corner is decided here rather than in the card, because it is a
 * claim about the service: the app may only say what the shop actually told
 * it. There is no turnaround field on a service, so nothing on this shelf
 * promises a time.
 */
import { minimumLabel } from './price-label';
import type { PricingUnit, Service } from './pricing';
import { CATEGORY_LABELS, type ServiceCategory } from './service-catalog';

/**
 * The corner label.
 *
 * `rule` when the shop set a billable minimum — the one fact the figure cannot
 * carry, and the one a customer is caught out by. `unit` otherwise: how the
 * shop counts this service, said as a promise rather than as a suffix.
 */
export type ShelfPillKind = 'rule' | 'unit';

export interface ShelfPill {
  text: string;
  kind: ShelfPillKind;
}

/** How the shop counts this one, worded for someone who has never ordered. */
function unitPromise(unit: PricingUnit): string {
  if (unit === 'per_kg') return 'By weight';
  if (unit === 'per_item') return 'Per piece';
  return 'Flat rate';
}

/**
 * `2 kg min`, or `By weight` — never a turnaround.
 *
 * The minimum wins when there is one: a 3 kg minimum on a per-kg service is
 * the difference between the ₱60 on the card and the ₱180 on the ticket, and
 * saying "By weight" in that corner instead would be true and useless.
 */
export function shelfPill(service: Service): ShelfPill {
  const minimum = minimumLabel(service);
  if (minimum) {
    // `minimumLabel` says "3 kg minimum"; a corner label has room for "min".
    return { kind: 'rule', text: minimum.replace(/minimum$/, 'min') };
  }
  return { kind: 'unit', text: unitPromise(service.unit) };
}

/** A service on the shelf, with the category label the grid gave it. */
export interface ShelfEntry<T> {
  service: T;
  label: string;
}

/** One heading on the menu and the services under it. */
export interface ShelfGroup<T> {
  category: ServiceCategory;
  /** The full category name — a heading has room the old card corner did not. */
  title: string;
  entries: ShelfEntry<T>[];
}

/**
 * The shelf as a menu: neighbouring services of one category under one
 * heading. The entries arrive already in category order, so this only draws
 * the lines between them — it never reorders what the shop set out.
 */
export function groupShelf<T extends { category: ServiceCategory }>(
  entries: readonly ShelfEntry<T>[]
): ShelfGroup<T>[] {
  return entries.reduce<ShelfGroup<T>[]>((groups, entry) => {
    const category = entry.service.category;
    const last = groups[groups.length - 1];
    if (last && last.category === category) {
      return [...groups.slice(0, -1), { ...last, entries: [...last.entries, entry] }];
    }
    return [
      ...groups,
      { category, title: CATEGORY_LABELS[category] ?? CATEGORY_LABELS.other, entries: [entry] },
    ];
  }, []);
}

/**
 * How many category groups sit side by side. A menu row needs the width of a
 * phone to breathe, so the groups stack until the window could hold three of
 * the old cards, then go two abreast and no further.
 */
export function shelfColumns(cardColumns: number): number {
  return cardColumns >= 3 ? 2 : 1;
}

/** Letters and digits only, folded to one case: a search box is not a parser. */
function fold(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Does this service answer what was typed?
 *
 * Every word has to land somewhere, but not all in the same field: "wash kg"
 * finds a wash-and-fold priced by weight, and "dry bed" finds nothing rather
 * than everything dry-cleaned. The haystack is what the customer can see on
 * the card plus the words behind it — the name, its category, the shop's own
 * description, and the unit — so typing what is on screen works.
 */
export function shelfMatches(
  service: Pick<Service, 'name' | 'unit'> & {
    category: ServiceCategory;
    description?: string | null;
  },
  query: string
): boolean {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) return true;
  const haystack = fold(
    [
      service.name,
      CATEGORY_LABELS[service.category] ?? '',
      service.description ?? '',
      service.unit === 'per_kg' ? 'kg weight kilo' : '',
      service.unit === 'per_item' ? 'piece item' : '',
      service.unit === 'flat' ? 'flat fixed' : '',
    ].join(' ')
  );
  return words.every((word) => haystack.includes(word));
}

/** The shelf narrowed to what was typed, in the order the grid already had. */
export function filterShelf<
  T extends Pick<Service, 'name' | 'unit'> & {
    category: ServiceCategory;
    description?: string | null;
  },
>(entries: readonly ShelfEntry<T>[], query: string): ShelfEntry<T>[] {
  if (fold(query).length === 0) return [...entries];
  return entries.filter((entry) => shelfMatches(entry.service, query));
}

/**
 * What the shelf says when a search finds nothing.
 *
 * Names the thing that failed and the way back, rather than saying "no
 * results" — the customer knows there are none, they typed it.
 */
export function shelfEmptyNote(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "This shop hasn't listed services yet.";
  return `Nothing here matches “${trimmed}”. Clear the search to see every service.`;
}
