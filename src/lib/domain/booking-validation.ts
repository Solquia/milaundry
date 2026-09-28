/**
 * The checks a booking has to pass before it is worth sending, each with a
 * sentence the customer can act on.
 *
 * The server refuses a bad booking too, but only after the customer has
 * pressed the last button, and in words written for a database. These run on
 * the step that can fix the problem: the load on Items, the address and the
 * times on Schedule.
 *
 * The rider windows are checked in `rider-calendar.ts`, on the shop's clock.
 */
import { MAX_WEIGHT_KG, type AddOnQuantities } from './booking-estimate';
import { isWeighed, type PricingUnit } from './pricing';

/** A shop will not send a rider for less than this. */
export const MIN_BOOKING_WEIGHT_KG = 1;

const ADDRESS_MAX = 300;
/** Short enough for "SM MOA" or "Blk 5A", long enough to catch a stray keypress. */
const ADDRESS_MIN = 5;

interface PricedService {
  id: string;
  unit: PricingUnit;
  max_quantity?: number;
  category?: string;
}

/** Whether the load can be booked, or the one sentence that says why not. */
export function validateBookingLoad(input: {
  service: PricedService;
  quantity: number;
  addOns: AddOnQuantities;
  catalog: readonly PricedService[];
}): string | null {
  const { service, quantity, addOns, catalog } = input;
  const isPerKg = isWeighed(service);
  const hasAddOns = Object.values(addOns).some((qty) => qty > 0);

  if (quantity <= 0 && !hasAddOns) {
    return isPerKg ? 'Tell us roughly how heavy your laundry is.' : 'Add at least one item.';
  }
  if (isPerKg && quantity > 0 && quantity < MIN_BOOKING_WEIGHT_KG) {
    return `The smallest load we can book is ${MIN_BOOKING_WEIGHT_KG} kg.`;
  }

  const perKg = new Set(catalog.filter((row) => row.unit === 'per_kg').map((row) => row.id));
  const addOnKg = Object.entries(addOns)
    .filter(([id]) => perKg.has(id))
    .reduce((sum, [, qty]) => sum + Math.max(0, qty), 0);
  const totalKg = (isPerKg ? quantity : 0) + addOnKg;
  if (totalKg > MAX_WEIGHT_KG) {
    return `That's more than ${MAX_WEIGHT_KG} kg — split it into two bookings.`;
  }
  return null;
}

/**
 * Whether a rider could find this. Not a geocoder — just enough to catch an
 * empty field, a stray keypress, or a number with no street attached.
 */
export function validateDeliveryAddress(address: string): string | null {
  const text = address.trim();
  if (!text) return 'Enter the pickup & delivery address.';
  if (text.length > ADDRESS_MAX) return `Keep the address under ${ADDRESS_MAX} characters.`;
  if (text.length < ADDRESS_MIN || !/[a-z]{2,}/i.test(text)) {
    return 'That address looks incomplete — add the street and city.';
  }
  return null;
}
