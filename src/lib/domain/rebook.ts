/**
 * "Book again": last time's order, as the start of the next one.
 *
 * Most laundry is a repeat — the same shop, the same wash-and-fold, the same
 * front gate, the same "no softener". This reads a finished order back into
 * everything the booking screen asks for, so the customer arrives on a filled
 * review they can change, rather than an empty form they have to re-answer.
 *
 * The order is the source, not the customer's current defaults: "again" means
 * like that one. Its instructions come back out of `orders.notes`, which
 * `formatBookingNotes` wrote in a shape `parseBookingNotes` can read.
 */
import { clampWeight, type AddOnQuantities } from './booking-estimate';
import { parseBookingNotes, type LaundryPreferences } from './laundry-preferences';
import type { OrderStatus } from './order-status';
import type { PricingUnit } from './pricing';
import type { Fulfillment } from './walk-in-order';

export interface RebookItem {
  /** Null once the shop deleted the service the line was priced from. */
  service_id: string | null;
  service_name: string;
  unit: PricingUnit;
  quantity: number;
}

/** The parts of an order a rebook reads. `OrderWithDetails` satisfies it. */
export interface RebookOrder {
  id: string;
  shop_id: string;
  status: OrderStatus;
  fulfillment: Fulfillment;
  delivery_address: string;
  notes: string;
  order_items: readonly RebookItem[];
}

export interface RebookDraft {
  orderId: string;
  shopId: string;
  /** The line the booking screen opens on. */
  serviceId: string;
  serviceUnit: PricingUnit;
  /** Weight for a per-kilo service, count for the others. */
  weightKg: number;
  addOns: AddOnQuantities;
  fulfillment: Fulfillment;
  deliveryAddress: string;
  preferences: LaundryPreferences;
  riderNotes: string;
  /** What each line was called, to name one the shop has since dropped. */
  itemNames: Record<string, string>;
}

type BookableItem = RebookItem & { service_id: string };

function bookableItems(order: Pick<RebookOrder, 'order_items'>): BookableItem[] {
  return order.order_items.filter(
    (item): item is BookableItem => Boolean(item.service_id) && item.quantity > 0
  );
}

/**
 * The line to open on: the per-kilo load when there is one, because that is
 * the booking; comforters and curtains ride along beside it.
 */
function mainItem(items: readonly BookableItem[]): BookableItem | null {
  return items.find((item) => item.unit === 'per_kg') ?? items[0] ?? null;
}

function mainQuantity(item: BookableItem): number {
  if (item.unit === 'per_kg') return clampWeight(item.quantity);
  return Math.max(1, Math.round(item.quantity));
}

export function hasBookableItem(order: Pick<RebookOrder, 'order_items'>): boolean {
  return bookableItems(order).length > 0;
}

/** Offered on a finished order that still names a service to book. */
export function canBookAgain(order: RebookOrder): boolean {
  return order.status === 'completed' && hasBookableItem(order);
}

export function rebookDraft(order: RebookOrder): RebookDraft | null {
  const items = bookableItems(order);
  const main = mainItem(items);
  if (!main) return null;

  const addOns: AddOnQuantities = {};
  const itemNames: Record<string, string> = {};
  for (const item of items) {
    itemNames[item.service_id] = item.service_name;
    if (item !== main) addOns[item.service_id] = item.quantity;
  }

  const { preferences, riderNotes } = parseBookingNotes(order.notes ?? '');
  const isDelivery = order.fulfillment === 'delivery';

  return {
    orderId: order.id,
    shopId: order.shop_id,
    serviceId: main.service_id,
    serviceUnit: main.unit,
    weightKg: mainQuantity(main),
    addOns,
    fulfillment: order.fulfillment,
    deliveryAddress: isDelivery ? order.delivery_address.trim() : '',
    preferences,
    riderNotes,
    itemNames,
  };
}

/** Where "Book again" goes: the old service's booking screen, carrying the order. */
export function rebookHref(order: RebookOrder): string | null {
  const main = mainItem(bookableItems(order));
  if (!main) return null;
  const query = `shopId=${encodeURIComponent(order.shop_id)}&rebook=${encodeURIComponent(order.id)}`;
  return `/(customer)/book/${encodeURIComponent(main.service_id)}?${query}`;
}

export interface ReconciledRebook {
  draft: RebookDraft;
  /** Add-ons from last time the shop no longer offers, by name. */
  droppedNames: string[];
  isMainOffered: boolean;
}

/**
 * The draft against the shop's price list today. An add-on that has gone is
 * dropped and named, so the customer is told rather than silently charged
 * less; a main service that has gone is the caller's to explain.
 */
export function reconcileRebook(
  draft: RebookDraft,
  offeredServiceIds: readonly string[]
): ReconciledRebook {
  const offered = new Set(offeredServiceIds);
  const addOns: AddOnQuantities = {};
  const droppedNames: string[] = [];

  for (const [serviceId, quantity] of Object.entries(draft.addOns)) {
    if (offered.has(serviceId)) addOns[serviceId] = quantity;
    else droppedNames.push(draft.itemNames[serviceId] ?? 'An item');
  }

  return {
    draft: droppedNames.length > 0 ? { ...draft, addOns } : draft,
    droppedNames,
    isMainOffered: offered.has(draft.serviceId),
  };
}
