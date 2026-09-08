/**
 * The basket on a shop's web page.
 *
 * The app books one main service at a time with a weight scale. A web
 * visitor is reading a full price list, so the page lets them add lines from
 * it: a few kilos of wash-and-fold, two shirts pressed, the pickup fee. Each
 * line steps by one whole unit, because a customer guessing a load's weight
 * in a browser does not want half-kilo precision, and the shop reweighs it
 * anyway.
 *
 * Every function returns a new cart. Nothing here mutates.
 */
import { MAX_WEIGHT_KG } from './booking-estimate';
import { estimateLineTotal, type OrderItemInput, type PricingUnit } from './pricing';

/** Service id → quantity. Absent means not in the basket. */
export type Cart = Readonly<Record<string, number>>;

export const EMPTY_CART: Cart = Object.freeze({});

export interface CartService {
  id: string;
  name: string;
  unit: PricingUnit;
  price: number;
  min_quantity: number;
}

export interface CartLine {
  service: CartService;
  quantity: number;
  subtotal: number;
}

/** Whole units: a kilo, a piece. A flat service is one or nothing. */
const STEP = 1;

/** Where a line starts: the shop's minimum, or one unit when there is none. */
function startingQuantity(service: CartService): number {
  if (service.unit === 'flat') return 1;
  const minimum = Number.isFinite(service.min_quantity) ? service.min_quantity : 0;
  return Math.max(minimum, STEP);
}

function without(cart: Cart, serviceId: string): Cart {
  const { [serviceId]: _removed, ...rest } = cart;
  return rest;
}

/**
 * One tap on a line's + or −.
 *
 * Adding to an absent line starts it at the minimum, so a 3 kg minimum never
 * shows "1 kg" only to be billed as three. Stepping below the minimum removes
 * the line, for the same reason. A flat service is on or off.
 */
export function adjustLine(cart: Cart, service: CartService, direction: 1 | -1): Cart {
  const current = cart[service.id] ?? 0;
  const floor = startingQuantity(service);

  if (direction > 0) {
    if (service.unit === 'flat') return { ...cart, [service.id]: 1 };
    const next = current === 0 ? floor : current + STEP;
    const capped = service.unit === 'per_kg' ? Math.min(next, MAX_WEIGHT_KG) : next;
    return { ...cart, [service.id]: capped };
  }

  const next = service.unit === 'flat' ? 0 : current - STEP;
  if (next < floor) return without(cart, service.id);
  return { ...cart, [service.id]: next };
}

/**
 * The basket priced against the catalog, in the catalog's order. A line whose
 * service the shop has since removed is dropped rather than priced at nothing.
 */
export function cartLines(cart: Cart, catalog: readonly CartService[]): CartLine[] {
  return catalog
    .filter((service) => (cart[service.id] ?? 0) > 0)
    .map((service) => {
      const quantity = cart[service.id];
      return { service, quantity, subtotal: estimateLineTotal(service, quantity) };
    });
}

export function cartTotal(lines: readonly CartLine[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.subtotal, 0) * 100) / 100;
}

/** The basket as `place_order` wants it. */
export function cartItems(cart: Cart): OrderItemInput[] {
  return Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([serviceId, quantity]) => ({ serviceId, quantity }));
}

/** How many lines are in the basket, for the footer. */
export function cartCount(cart: Cart): number {
  return cartItems(cart).length;
}

/**
 * The basket the booking page opens with when a price row was tapped: that
 * service, at the quantity its first "+" would give, so the customer arrives
 * with the decision already made. A repeated query key arrives as an array;
 * an id the shop no longer sells opens an empty basket rather than a broken
 * line.
 */
export function startingCart(
  serviceId: string | string[] | undefined,
  catalog: readonly CartService[]
): Cart {
  const id = Array.isArray(serviceId) ? serviceId[0] : serviceId;
  if (!id) return EMPTY_CART;
  const service = catalog.find((item) => item.id === id);
  return service ? adjustLine(EMPTY_CART, service, 1) : EMPTY_CART;
}

/**
 * The basket as one query value, `id:qty,id:qty`, so the price list can
 * hand a whole basket to the booking page in the address. Empty encodes to
 * nothing, so the page's own link stays clean.
 */
export function encodeCart(cart: Cart): string {
  return cartItems(cart)
    .map((item) => `${item.serviceId}:${item.quantity}`)
    .join(',');
}

/** The largest quantity a line may carry: the weight cap for kilos, one for flat. */
function cappedQuantity(service: CartService, quantity: number): number {
  if (service.unit === 'flat') return 1;
  const floor = startingQuantity(service);
  const capped = service.unit === 'per_kg' ? Math.min(quantity, MAX_WEIGHT_KG) : quantity;
  return Math.max(capped, floor);
}

/**
 * A basket read back from the address and held to the shop's rules: unknown
 * services are dropped, non-numbers are dropped, minimums and the weight cap
 * are applied, a flat line is one. A hand-edited link cannot book a line the
 * shop would refuse.
 */
export function decodeCart(raw: string | string[] | undefined, catalog: readonly CartService[]): Cart {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return EMPTY_CART;
  const entries = value
    .split(',')
    .map((pair) => pair.split(':'))
    .filter((pair): pair is [string, string] => pair.length === 2)
    .map(([id, qty]) => [catalog.find((service) => service.id === id), Number(qty)] as const)
    .filter((pair): pair is readonly [CartService, number] => {
      const [service, qty] = pair;
      return service !== undefined && Number.isInteger(qty) && qty > 0;
    })
    .map(([service, qty]) => [service.id, cappedQuantity(service, qty)] as const);
  return entries.length === 0 ? EMPTY_CART : Object.fromEntries(entries);
}

/** What the booking page opens with: a whole basket, else one tapped service, else nothing. */
export function cartFromParams(
  params: { cart?: string | string[]; service?: string | string[] },
  catalog: readonly CartService[]
): Cart {
  const fromCart = decodeCart(params.cart, catalog);
  if (fromCart !== EMPTY_CART) return fromCart;
  return startingCart(params.service, catalog);
}
