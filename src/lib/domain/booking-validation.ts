/**
 * The checks a booking has to pass before it is worth sending, each with a
 * sentence the customer can act on.
 *
 * The server refuses a bad booking too, but only after the customer has
 * pressed the last button, and in words written for a database. These run on
 * the step that can fix the problem: the load on Items, the address and the
 * times on Schedule.
 *
 * `now` is always passed in, so the slot rules can be tested at 5:30 PM
 * without waiting for 5:30 PM.
 */
import { MAX_WEIGHT_KG, type AddOnQuantities } from './booking-estimate';
import { BOOKING_WINDOW_DAYS, SLOT_HOURS, type Slot } from './booking-slot';
import type { PricingUnit } from './pricing';

/** A shop will not send a rider for less than this. */
export const MIN_BOOKING_WEIGHT_KG = 1;
/** How far ahead of a slot the booking has to land for a rider to make it. */
export const SLOT_LEAD_MINUTES = 60;

const ADDRESS_MAX = 300;
const ADDRESS_MIN = 8;

interface PricedService {
  id: string;
  unit: PricingUnit;
}

/** Whether the load can be booked, or the one sentence that says why not. */
export function validateBookingLoad(input: {
  service: PricedService;
  quantity: number;
  addOns: AddOnQuantities;
  catalog: readonly PricedService[];
}): string | null {
  const { service, quantity, addOns, catalog } = input;
  const isPerKg = service.unit === 'per_kg';
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

function slotTime(dayOffset: number, hour: number, now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour).getTime();
}

/** The hours a rider can still be booked for on that day. */
export function openHours(
  dayOffset: number,
  now: Date,
  maxOffset: number = BOOKING_WINDOW_DAYS
): number[] {
  if (dayOffset < 0 || dayOffset > maxOffset) return [];
  const earliest = now.getTime() + SLOT_LEAD_MINUTES * 60 * 1000;
  return SLOT_HOURS.filter((hour) => slotTime(dayOffset, hour, now) >= earliest);
}

/** The hours the laundry can come back on that day, given when it leaves. */
export function deliveryHours(deliverDay: number, pickup: Slot, now: Date): number[] {
  if (deliverDay < pickup.dayOffset) return [];
  const hours = openHours(deliverDay, now, pickup.dayOffset + BOOKING_WINDOW_DAYS);
  return deliverDay === pickup.dayOffset ? hours.filter((hour) => hour > pickup.hour) : hours;
}

/**
 * A schedule that is valid the moment the screen opens: the first pickup a
 * rider can make — at last time's hour when that is still on offer — and the
 * laundry back a day later at the same hour.
 */
export function suggestSchedule(
  now: Date,
  preferredHour?: number
): { pickup: Slot; deliver: Slot } | null {
  const wantsHour = preferredHour !== undefined && SLOT_HOURS.includes(preferredHour);
  for (let day = 0; day <= BOOKING_WINDOW_DAYS; day += 1) {
    const hours = openHours(day, now);
    const hour = wantsHour ? hours.find((open) => open === preferredHour) : hours[0];
    if (hour !== undefined) {
      return { pickup: { dayOffset: day, hour }, deliver: { dayOffset: day + 1, hour } };
    }
  }
  return null;
}

export type SlotProblems = Partial<Record<'pickupAt' | 'deliverBy', string>>;

function pickupProblem(pickup: Slot, now: Date): string | undefined {
  const hours = openHours(pickup.dayOffset, now);
  if (hours.length === 0) {
    return pickup.dayOffset === 0
      ? 'No pickup times left today — choose another day.'
      : 'No pickup times that day — choose another day.';
  }
  if (!hours.includes(pickup.hour)) return 'That pickup time has passed — choose a later one.';
  return undefined;
}

function deliveryProblem(pickup: Slot, deliver: Slot, now: Date): string | undefined {
  if (deliver.dayOffset < pickup.dayOffset) return 'Delivery must come after pickup.';
  const hours = deliveryHours(deliver.dayOffset, pickup, now);
  if (hours.length === 0) return 'No delivery times left that day — choose a later day.';
  const isSameDayEarlier = deliver.dayOffset === pickup.dayOffset && deliver.hour <= pickup.hour;
  if (isSameDayEarlier) return 'Delivery must come after pickup.';
  if (!hours.includes(deliver.hour)) return 'That delivery time is not available — choose another.';
  return undefined;
}

/** What is wrong with the chosen pair of slots, per leg; empty when nothing is. */
export function slotProblems(pickup: Slot, deliver: Slot, now: Date): SlotProblems {
  const problems: SlotProblems = {};
  const pickupAt = pickupProblem(pickup, now);
  const deliverBy = deliveryProblem(pickup, deliver, now);
  if (pickupAt) problems.pickupAt = pickupAt;
  if (deliverBy) problems.deliverBy = deliverBy;
  return problems;
}
