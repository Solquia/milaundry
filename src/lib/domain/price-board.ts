/**
 * How the owner's Prices screen arranges a list of prices into a board.
 *
 * The first cut printed "1 kg minimum" under four rows in a row, dropped the
 * unit from every flat price, and gave a shop of fifteen prices no way to find
 * one but scrolling. These helpers say a shared fact once, give every figure a
 * unit the owner can read at a glance, and narrow the board to what was asked.
 */
import { capacityLabel, minimumLabel } from './price-label';
import type { Service } from './pricing';
import {
  groupServicesByCategory,
  type CategorizedService,
  type ServiceCategory,
  type ServiceGroup,
} from './service-catalog';

type BoardService = Service & CategorizedService & { name: string };

export type BoardCategory = ServiceCategory | 'all';

/**
 * The minimum every weighed or counted row in a category shares — `1 kg
 * minimum` — for the category's heading, or null when the rows disagree or
 * only one row has a minimum to share.
 */
export function sharedMinimum(services: readonly Service[]): string | null {
  const measured = services.filter((service) => service.unit !== 'flat');
  if (measured.length < 2) return null;
  const labels = measured.map(minimumLabel);
  const first = labels[0];
  if (!first) return null;
  return labels.every((label) => label === first) ? first : null;
}

/** A row's own minimum, or null when the heading already says it. */
export function rowMinimum(service: Service, shared: string | null): string | null {
  const label = minimumLabel(service);
  return label === shared ? null : label;
}

/**
 * The unit beneath a figure, in words. On the customer's side a flat price
 * wears no unit at all; the owner is the one who set it, and on a board of
 * mixed units "₱150" beside "₱150/piece" reads as a unit forgotten.
 */
export function unitWord(service: Service): string {
  if (service.unit === 'per_kg') return 'per kg';
  if (service.unit === 'per_item') return 'per piece';
  return capacityLabel(service) ? 'per load' : 'flat rate';
}

/** The board narrowed to one category and a name search, empty groups dropped. */
export function boardFilter<T extends BoardService>(
  services: readonly T[],
  category: BoardCategory,
  query: string
): ServiceGroup<T>[] {
  const needle = query.trim().toLowerCase();
  const matching = needle
    ? services.filter((service) => service.name.toLowerCase().includes(needle))
    : services;
  const groups = groupServicesByCategory(matching);
  return category === 'all' ? groups : groups.filter((group) => group.category === category);
}
