/**
 * The market storefront's basket.
 *
 * A customer on the market page adds services the way they add food on a
 * delivery app: a tap on "+", a count on the card, a bar at the foot with the
 * total. Checkout is the same booking every other page uses, so the basket
 * ends by turning itself into what that booking opens with — one main line and
 * the rest alongside, exactly the shape "Book again" already hands it.
 *
 * One rule is the laundry's, not the shop's: a booking carries one load. The
 * load is weighed at the counter and its size is picked at checkout, so a
 * second load service does not stack — it takes the first one's place, and the
 * caller is told which went so it can say so. Pieces (a barong, a comforter)
 * stack by the piece up to the booking's limit.
 */
import { estimateBooking, type AddOnQuantities } from './booking-estimate';
import { MIN_BOOKING_WEIGHT_KG } from './booking-validation';
import { loadSizes } from './load-size';
import { isWeighed, type Service } from './pricing';
import { MAX_PIECES } from './quantity-input';
import type { ServiceCategory } from './service-catalog';

/** Service id → how many. A load is always 1: its weight is picked at checkout. */
export type Cart = Readonly<Record<string, number>>;

export const EMPTY_CART: Cart = Object.freeze({});

export type CartService = Service & { category: ServiceCategory; min_quantity: number };

export interface CartLine<T extends CartService> {
  service: T;
  quantity: number;
}

/** A link carries at most this many lines; anything past it is noise. */
const MAX_LINES = 30;

/** Whether this service is a load, sized at checkout, rather than counted pieces. */
export function isLoad(service: CartService): boolean {
  return isWeighed(service);
}

export function addToCart<T extends CartService>(
  cart: Cart,
  service: T,
  catalog: readonly T[]
): { cart: Cart; swappedOut: string | null } {
  if (isLoad(service)) {
    const other = catalog.find(
      (row) => row.id !== service.id && isLoad(row) && (cart[row.id] ?? 0) > 0
    );
    const rest = other ? withoutLine(cart, other.id) : cart;
    return { cart: { ...rest, [service.id]: 1 }, swappedOut: other?.name ?? null };
  }
  const next = Math.min(MAX_PIECES, (cart[service.id] ?? 0) + 1);
  return { cart: { ...cart, [service.id]: next }, swappedOut: null };
}

export function removeFromCart(cart: Cart, serviceId: string): Cart {
  const current = cart[serviceId] ?? 0;
  if (current <= 0) return cart;
  if (current === 1) return withoutLine(cart, serviceId);
  return { ...cart, [serviceId]: current - 1 };
}

function withoutLine(cart: Cart, serviceId: string): Cart {
  return Object.fromEntries(Object.entries(cart).filter(([id]) => id !== serviceId));
}

/** The basket's lines in the shop's own menu order, skipping anything it no longer offers. */
export function cartLines<T extends CartService>(cart: Cart, catalog: readonly T[]): CartLine<T>[] {
  return catalog
    .filter((service) => (cart[service.id] ?? 0) > 0)
    .map((service) => ({ service, quantity: cart[service.id] }));
}

/** What the badge on the basket says: a load counts once, pieces by the piece. */
export function cartCount(cart: Cart, catalog: readonly CartService[]): number {
  return cartLines(cart, catalog).reduce((sum, line) => sum + line.quantity, 0);
}

/** Only what the shop still offers — a basket kept across a price-list change. */
export function pruneCart(cart: Cart, catalog: readonly CartService[]): Cart {
  return Object.fromEntries(cartLines(cart, catalog).map((line) => [line.service.id, line.quantity]));
}

export interface CartBooking {
  /** The line the booking opens on: the load when there is one. */
  serviceId: string;
  /** Kilos for a load, a count for pieces. */
  weightKg: number;
  addOns: AddOnQuantities;
}

/** The basket as the booking opens with it, or null when there is nothing to book. */
export function cartBooking(cart: Cart, catalog: readonly CartService[]): CartBooking | null {
  const lines = cartLines(cart, catalog);
  // The load when there is one; else a counted line, because a flat price on
  // the main line is billed once however many pieces it says.
  const main =
    lines.find((line) => isLoad(line.service)) ??
    lines.find((line) => line.service.unit !== 'flat') ??
    lines[0];
  if (!main) return null;

  const addOns: AddOnQuantities = {};
  for (const line of lines) {
    if (line !== main) addOns[line.service.id] = line.quantity;
  }
  if (isLoad(main.service)) {
    // The smallest size card the checkout offers, so one is already chosen
    // when it opens; that card never sits below the shop's minimum.
    const weightKg =
      loadSizes(main.service)[0]?.kg ?? Math.max(MIN_BOOKING_WEIGHT_KG, main.service.min_quantity || 0);
    return { serviceId: main.service.id, weightKg, addOns };
  }
  if (main.service.unit === 'flat' && main.quantity > 1) {
    // One piece on the main line, the rest as their own flat lines.
    return { serviceId: main.service.id, weightKg: 1, addOns: { ...addOns, [main.service.id]: main.quantity - 1 } };
  }
  return { serviceId: main.service.id, weightKg: main.quantity, addOns };
}

/**
 * A checkout turned back into the basket it came from, for "Edit" on the
 * market's checkout: the load counts once, pieces by the piece, and a flat
 * piece split across lines (see `cartBooking`) folds back into one count.
 */
export function bookingToCart(
  serviceId: string,
  quantity: number,
  addOns: AddOnQuantities,
  catalog: readonly CartService[]
): Cart {
  const main = catalog.find((service) => service.id === serviceId);
  const counts: Record<string, number> = {};
  if (main && quantity > 0) counts[main.id] = isLoad(main) ? 1 : Math.round(quantity);
  for (const [id, count] of Object.entries(addOns)) {
    if (count > 0) counts[id] = (counts[id] ?? 0) + Math.round(count);
  }
  const capped = Object.fromEntries(
    Object.entries(counts).map(([id, count]) => [id, Math.min(MAX_PIECES, count)])
  );
  return pruneCart(capped, catalog);
}

/**
 * The basket's price as the booking will open on it. A load is priced at its
 * smallest size, so this is a "from" figure whenever the basket holds one.
 */
export function cartEstimate(cart: Cart, catalog: readonly CartService[]): number | null {
  const booking = cartBooking(cart, catalog);
  if (!booking) return null;
  return estimateBooking(catalog, booking.serviceId, booking.weightKg, booking.addOns)?.total ?? null;
}

/** The basket in a link: `id:qty,id:qty`. */
export function encodeCart(cart: Cart): string {
  return Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => `${id}:${quantity}`)
    .join(',');
}

/**
 * A basket read back from a link. Anything malformed is dropped rather than
 * repaired: a link is typed by nobody, so a bad entry is damage, not intent.
 */
export function decodeCart(param: string | string[] | undefined): Cart {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw) return EMPTY_CART;

  const cart: Record<string, number> = {};
  for (const entry of raw.split(',').slice(0, MAX_LINES)) {
    const [id, count, extra] = entry.split(':');
    if (!id || count === undefined || extra !== undefined) continue;
    if (!/^\d+$/.test(count)) continue;
    const quantity = Math.min(MAX_PIECES, Number(count));
    if (quantity > 0) cart[id] = quantity;
  }
  return cart;
}
