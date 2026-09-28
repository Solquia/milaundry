/**
 * How much laundry, said the way a customer knows it: a bag, a basket, a
 * hamper — not a number on a scale they have never stood their laundry on.
 *
 * The shop weighs the load anyway, so a kilogram ruler bought false precision
 * and cost a drag. Each size here is a round weight behind a familiar name;
 * the booking still sends kilograms, and "exact weight" stays one tap away for
 * the customer who did weigh it.
 *
 * A shop minimum never shows up as a size below it that the customer would be
 * billed up from. The smallest size on offer *is* the minimum, and says so.
 */
import { MIN_BOOKING_WEIGHT_KG } from '@/lib/domain/booking-validation';
import type { Service } from '@/lib/domain/pricing';

export interface LoadSize {
  kg: number;
  label: string;
  /** One short line under the label: what that looks like at home. */
  hint: string;
  /** How many baskets its art stacks: 1–4. */
  baskets: number;
  /** The minimum charge covers exactly this size. */
  isMinimum: boolean;
}

/** The everyday sizes, smallest first. */
const STANDARD: readonly { kg: number; label: string; hint: string }[] = [
  { kg: 3, label: 'Small bag', hint: 'A few days of clothes' },
  { kg: 5, label: 'One basket', hint: 'About a week for one' },
  { kg: 8, label: 'Full basket', hint: 'Heaped to the top' },
  { kg: 12, label: 'Two baskets', hint: 'A week for a family' },
  { kg: 18, label: 'Big haul', hint: 'Two weeks, or linens too' },
  { kg: 24, label: 'Family hamper', hint: 'Everything, all at once' },
];

const SIZES_SHOWN = 4;
/** The water never sits empty or brims over the porthole's glass. */
const LEVEL_LOW = 0.2;
const LEVEL_RANGE = 0.65;

function shopMinimum(service: Service): number {
  if (service.unit === 'flat') return 0;
  const minimum = service.min_quantity ?? 0;
  return Number.isFinite(minimum) && minimum > 0 ? minimum : 0;
}

function basketsFor(kg: number): number {
  if (kg <= 5) return 1;
  if (kg <= 12) return 2;
  if (kg <= 18) return 3;
  return 4;
}

/** The lightest load this service can be booked with. */
export function loadFloor(service: Service): number {
  return Math.max(MIN_BOOKING_WEIGHT_KG, shopMinimum(service));
}

/** The sizes on offer for this service, smallest first. */
export function loadSizes(service: Service): LoadSize[] {
  const minimum = shopMinimum(service);
  const above = STANDARD.filter((size) => size.kg >= minimum);
  // A minimum that cuts into the list becomes a size of its own; one below
  // the smallest standard size is already covered by it.
  const needsMinimumSize =
    minimum > STANDARD[0].kg && !STANDARD.some((size) => size.kg === minimum);
  const base = needsMinimumSize
    ? [{ kg: minimum, label: 'Minimum load', hint: 'The least this shop takes' }, ...above]
    : above;
  return base.slice(0, SIZES_SHOWN).map((size, index) => ({
    ...size,
    baskets: basketsFor(size.kg),
    isMinimum: minimum > 0 && index === 0 && size.kg === minimum,
  }));
}

/** The size a weight is exactly, or null for a weight typed in between. */
export function loadSizeFor(sizes: readonly LoadSize[], kg: number): LoadSize | null {
  return sizes.find((size) => size.kg === kg) ?? null;
}

/** The load in one line for its ticket row. */
export function loadSummary(sizes: readonly LoadSize[], kg: number): string {
  const size = loadSizeFor(sizes, kg);
  return size ? `${size.label} · up to ${size.kg} kg` : `${kg} kg, weighed at home`;
}

/**
 * The note shown once a per-load weight spills past one load. The price quoted
 * is one load's, and the counter can only re-weigh per-kilo lines, so the note
 * points at the one thing the customer can do: book the rest separately.
 */
export function overLoadNotice(service: Service, kg: number): string | null {
  if (service.unit !== 'flat') return null;
  const perLoad = service.max_quantity ?? 0;
  if (!(perLoad > 0) || !(kg > perLoad)) return null;
  return `One load holds up to ${perLoad} kg — this price covers one load. Book the rest as another load.`;
}

/** 0–1: how high the water stands in the porthole for this weight. */
export function loadLevel(sizes: readonly LoadSize[], kg: number): number {
  const biggest = sizes[sizes.length - 1]?.kg ?? kg;
  const share = biggest > 0 ? Math.min(Math.max(kg, 0) / biggest, 1) : 0;
  return Math.round((LEVEL_LOW + LEVEL_RANGE * share) * 100) / 100;
}
