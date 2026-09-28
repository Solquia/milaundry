import {
  estimateOrderTotal,
  type OrderEstimate,
  type OrderItemInput,
  type Service,
} from './pricing';

/** Household washers rarely take more than this in one booking. */
export const MAX_WEIGHT_KG = 30;
export const WEIGHT_STEP_KG = 0.5;

/** Snaps a customer's weight guess to a half-kilo inside [0, MAX_WEIGHT_KG]. */
export function clampWeight(kg: number): number {
  if (!Number.isFinite(kg)) return 0;
  const snapped = Math.round(kg / WEIGHT_STEP_KG) * WEIGHT_STEP_KG;
  return Math.min(MAX_WEIGHT_KG, Math.max(0, snapped));
}

/** Per-service add-on counts, e.g. { comforterId: 2 }. Zero counts are ignored. */
export type AddOnQuantities = Record<string, number>;

/**
 * Order lines for a booking: the main service billed by estimated weight,
 * plus any heavy items (comforters, curtains, beddings) as their own lines.
 */
export function buildBookingItems(
  mainServiceId: string,
  weightKg: number,
  addOns: AddOnQuantities,
  /** The shop's services, so a flat extra can be split into one line each. */
  catalog: readonly Service[] = []
): OrderItemInput[] {
  const items: OrderItemInput[] = [];
  if (weightKg > 0) {
    items.push({ serviceId: mainServiceId, quantity: weightKg });
  }
  const units = new Map(catalog.map((service) => [service.id, service.unit]));
  for (const [serviceId, quantity] of Object.entries(addOns)) {
    if (!(quantity > 0)) continue;
    // A flat price is billed once per line, by the server as here. Three
    // comforters at a flat ₱200 go as three lines, so they cost ₱600.
    if (units.get(serviceId) === 'flat') {
      for (let piece = 0; piece < Math.round(quantity); piece += 1) {
        items.push({ serviceId, quantity: 1 });
      }
    } else {
      items.push({ serviceId, quantity });
    }
  }
  return items;
}

/**
 * Live estimate for the booking screen, or null while the selection can't be
 * priced yet (nothing selected, or a service unknown to this shop's catalog).
 */
export function estimateBooking(
  catalog: readonly Service[],
  mainServiceId: string,
  weightKg: number,
  addOns: AddOnQuantities
): OrderEstimate | null {
  const items = buildBookingItems(mainServiceId, weightKg, addOns, catalog);
  if (items.length === 0) return null;
  try {
    return estimateOrderTotal(catalog, items);
  } catch {
    return null;
  }
}
