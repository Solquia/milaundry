import type { Fulfillment } from './walk-in-order';

/** Default promise between rider pickup and delivery back to the customer. */
export const DELIVERY_TURNAROUND_HOURS = 24;

const HOUR_MS = 60 * 60 * 1000;

export interface BookingSchedule {
  pickupAt: Date;
  deliverBy: Date;
}

/** Suggested schedule: pickup at the top of the next hour, back a day later. */
export function defaultSchedule(now: Date): BookingSchedule {
  const pickupAt = new Date(now);
  pickupAt.setMinutes(0, 0, 0);
  pickupAt.setTime(pickupAt.getTime() + HOUR_MS);
  const deliverBy = new Date(
    pickupAt.getTime() + DELIVERY_TURNAROUND_HOURS * HOUR_MS
  );
  return { pickupAt, deliverBy };
}

export interface BookingScheduleInput {
  fulfillment: Fulfillment;
  deliveryAddress: string;
  /** Null when the customer hands the laundry over themselves. */
  pickupAt: Date | null;
  deliverBy: Date | null;
}

export interface BookingScheduleDetails {
  fulfillment: Fulfillment;
  /** Trimmed address for delivery orders; '' for self drop-off. */
  deliveryAddress: string;
  pickupAt: Date | null;
  deliverBy: Date | null;
}

export type BookingScheduleErrors = Partial<
  Record<'deliveryAddress' | 'pickupAt' | 'deliverBy', string>
>;

export type BookingScheduleResult =
  | { ok: true; value: BookingScheduleDetails }
  | { ok: false; errors: BookingScheduleErrors };

/**
 * Validates the delivery leg of a booking. Self drop-off ('pickup') needs no
 * address or times; rider delivery needs all three and a sane ordering.
 */
export function validateBookingSchedule(
  input: BookingScheduleInput,
  now: Date
): BookingScheduleResult {
  if (input.fulfillment === 'pickup') {
    return {
      ok: true,
      value: {
        fulfillment: 'pickup',
        deliveryAddress: '',
        pickupAt: null,
        deliverBy: null,
      },
    };
  }

  const errors: BookingScheduleErrors = {};

  const deliveryAddress = input.deliveryAddress.trim();
  if (!deliveryAddress) {
    errors.deliveryAddress = 'Enter the pickup & delivery address.';
  }

  if (!input.pickupAt) {
    errors.pickupAt = 'Choose a pickup time.';
  } else if (input.pickupAt.getTime() <= now.getTime()) {
    errors.pickupAt = 'Pickup time must be in the future.';
  }

  if (!input.deliverBy) {
    errors.deliverBy = 'Choose a delivery time.';
  } else if (input.pickupAt && input.deliverBy.getTime() <= input.pickupAt.getTime()) {
    errors.deliverBy = 'Delivery must come after pickup.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      fulfillment: 'delivery',
      deliveryAddress,
      pickupAt: input.pickupAt,
      deliverBy: input.deliverBy,
    },
  };
}
