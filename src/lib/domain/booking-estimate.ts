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
  addOns: AddOnQuantities
): OrderItemInput[] {
  const items: OrderItemInput[] = [];
  if (weightKg > 0) {
    items.push({ serviceId: mainServiceId, quantity: weightKg });
  }
  for (const [serviceId, quantity] of Object.entries(addOns)) {
    if (quantity > 0) {
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
  const items = buildBookingItems(mainServiceId, weightKg, addOns);
  if (items.length === 0) return null;
  try {
    return estimateOrderTotal(catalog, items);
  } catch {
    return null;
  }
}
