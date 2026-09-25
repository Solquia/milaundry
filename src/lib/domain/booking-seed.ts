/**
 * Where a booking starts: the step it opens on and every answer it opens with.
 *
 * Shared by the app's booking screen and the shop's web booking page, so a
 * customer is asked the same questions, with the same defaults, wherever they
 * book from.
 */
import type { AddOnQuantities } from '@/lib/domain/booking-estimate';
import type { Slot } from '@/lib/domain/booking-slot';
import {
  MIN_BOOKING_WEIGHT_KG,
  suggestSchedule,
  validateBookingLoad,
  validateDeliveryAddress,
} from '@/lib/domain/booking-validation';
import {
  limitToSupported,
  type LaundryPreferences,
  type PreferenceKey,
} from '@/lib/domain/laundry-preferences';
import type { RebookDraft } from '@/lib/domain/rebook';
import type { Fulfillment } from '@/lib/domain/walk-in-order';
import type { ServiceRow } from '@/lib/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A concrete Date from "N days from today at H o'clock". */
export function slotDate(dayOffset: number, hour: number): Date {
  const date = new Date(Date.now() + dayOffset * DAY_MS);
  date.setHours(hour, 0, 0, 0);
  return date;
}

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

/** A day's hour kept when it is still on offer, else the next one that is. */
export function snapToOpen(slot: SlotValue, hours: readonly number[]): SlotValue {
  if (hours.length === 0 || hours.includes(slot.hour)) return slot;
  return { ...slot, hour: hours.find((hour) => hour > slot.hour) ?? hours[0] };
}

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

/** Only reached when no rider slot is open in the whole window. */
const FALLBACK_SCHEDULE = {
  pickup: { dayOffset: 1, hour: 10 },
  deliver: { dayOffset: 2, hour: 10 },
};

export function seedBooking(input: {
  draft: RebookDraft | null;
  droppedNames: string[];
  previousPickupAt: string | null;
  usual: LaundryPreferences;
  supported: readonly PreferenceKey[];
  service: ServiceRow;
  services: readonly ServiceRow[];
  now: Date;
}): BookingSeed {
  const { draft, service, services, now } = input;
  const previousHour = input.previousPickupAt
    ? new Date(input.previousPickupAt).getHours()
    : undefined;
  const schedule = suggestSchedule(now, previousHour) ?? FALLBACK_SCHEDULE;
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
        service.unit === 'per_kg'
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
