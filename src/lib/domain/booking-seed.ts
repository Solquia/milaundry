/**
 * Where a booking starts: the step it opens on and every answer it opens with.
 *
 * Shared by the app's booking screen and the shop's web booking page, so a
 * customer is asked the same questions, with the same defaults, wherever they
 * book from.
 */
import type { AddOnQuantities } from '@/lib/domain/booking-estimate';
import {
  MIN_BOOKING_WEIGHT_KG,
  validateBookingLoad,
  validateDeliveryAddress,
} from '@/lib/domain/booking-validation';
import {
  limitToSupported,
  type LaundryPreferences,
  type PreferenceKey,
} from '@/lib/domain/laundry-preferences';
import { isWeighed } from '@/lib/domain/pricing';
import type { RebookDraft } from '@/lib/domain/rebook';
import {
  DEFAULT_SHOP_HOURS,
  addDays,
  shopSlotOf,
  shopToday,
  suggestSchedule,
  type ShopHours,
  type Slot,
} from '@/lib/domain/rider-calendar';
import type { Fulfillment } from '@/lib/domain/walk-in-order';
import type { ServiceRow } from '@/lib/types';

export type SlotValue = Slot;
export type BookingStep = 'items' | 'schedule' | 'review';

/**
 * The three questions, in the order a counter asks them. Declared once so the
 * rail, the Back button and the footer all count the same steps.
 */
export const BOOKING_STEPS = [
  { key: 'items', label: 'Items' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'review', label: 'Review' },
] as const satisfies readonly { key: BookingStep; label: string }[];

/** What the booking opens with: last time's order, or the customer's usual. */
export interface BookingSeed {
  step: BookingStep;
  weightKg: number;
  addOns: AddOnQuantities;
  fulfillment: Fulfillment;
  /** Null: take the default saved address. */
  address: string | null;
  /** Null: take the rider instructions saved with the address. */
  riderNotes: string | null;
  preferences: LaundryPreferences;
  pickup: SlotValue;
  deliver: SlotValue;
  /** Set on "Book again": what last time had that the shop no longer offers. */
  rebook: { droppedNames: string[] } | null;
}

/**
 * Only reached when no rider window is open in the whole booking window — a
 * shop closed every day. The schedule step then says so on every day it shows.
 */
function fallbackSchedule(now: Date, hours: ShopHours): { pickup: Slot; deliver: Slot } {
  const today = shopToday(now, hours);
  const hour = hours.windowStarts[0] ?? 10;
  return {
    pickup: { day: addDays(today, 1), hour },
    deliver: { day: addDays(today, 2), hour },
  };
}

export function seedBooking(input: {
  draft: RebookDraft | null;
  droppedNames: string[];
  previousPickupAt: string | null;
  usual: LaundryPreferences;
  supported: readonly PreferenceKey[];
  service: ServiceRow;
  services: readonly ServiceRow[];
  now: Date;
  /** How the shop runs its riders; the default until shops can set their own. */
  hours?: ShopHours;
}): BookingSeed {
  const { draft, service, services, now } = input;
  const hours = input.hours ?? DEFAULT_SHOP_HOURS;
  // Last time's hour on the shop's clock, not the phone's: a customer who
  // travelled since would otherwise be offered a window that never existed.
  const previousHour = input.previousPickupAt
    ? shopSlotOf(new Date(input.previousPickupAt), hours).hour
    : undefined;
  const schedule = suggestSchedule(now, hours, previousHour) ?? fallbackSchedule(now, hours);
  const base = {
    preferences: limitToSupported(draft?.preferences ?? input.usual, input.supported),
    pickup: schedule.pickup,
    deliver: schedule.deliver,
  };

  if (!draft) {
    return {
      ...base,
      step: 'items',
      // The smallest load the shop takes, not zero: a scale that opens on a
      // weight nobody can book starts the customer on an error.
      weightKg:
        isWeighed(service)
          ? Math.max(MIN_BOOKING_WEIGHT_KG, service.min_quantity || 0)
          : 1,
      addOns: {},
      fulfillment: 'delivery',
      address: null,
      riderNotes: null,
      rebook: null,
    };
  }

  const loadProblem = validateBookingLoad({
    service,
    quantity: draft.weightKg,
    addOns: draft.addOns,
    catalog: services,
  });
  const addressProblem =
    draft.fulfillment === 'delivery' ? validateDeliveryAddress(draft.deliveryAddress) : null;

  return {
    ...base,
    // Straight to the review when last time still holds — that is the whole
    // point of booking again — and otherwise to the first step that needs an
    // answer, so nothing is placed on a guess.
    step: loadProblem ? 'items' : addressProblem ? 'schedule' : 'review',
    weightKg: draft.weightKg,
    addOns: draft.addOns,
    fulfillment: draft.fulfillment,
    address: draft.deliveryAddress || null,
    riderNotes: draft.riderNotes,
    rebook: { droppedNames: input.droppedNames },
  };
}
