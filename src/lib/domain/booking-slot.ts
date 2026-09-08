/**
 * How a booking slot reads to the person choosing it.
 *
 * The schedule step showed two identical walls of chips — four days, then six
 * hours, twice — and never said back what had been chosen. A customer had to
 * find the blue chip in one row, find the blue chip in the next, and assemble
 * "Tomorrow at 4 PM" in their head, for both the pickup and the delivery. These
 * helpers make the app say the sentence instead.
 *
 * `now` is passed in rather than read from the clock, so a label can be tested
 * without the answer depending on the day CI happens to run.
 */

export interface Slot {
  /** Days from today. 0 is today. */
  dayOffset: number;
  /** Hour of the day, 24-hour. */
  hour: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Today and tomorrow get their names; anything further gets a date, because
 * "in 3 days" makes the customer count on their fingers.
 */
export function dayLabel(offset: number, now: Date): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return new Date(now.getTime() + offset * DAY_MS).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** The 12-hour clock the shop speaks in. Noon and midnight break naive modulo. */
export function hourLabel(hour: number): string {
  const meridiem = hour >= 12 && hour < 24 ? 'PM' : 'AM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display} ${meridiem}`;
}

/** The whole choice in one line: `Tomorrow, 4 PM`. */
export function slotSummary(slot: Slot, now: Date): string {
  return `${dayLabel(slot.dayOffset, now)}, ${hourLabel(slot.hour)}`;
}

/**
 * How long the shop has, said the way a counter says it.
 *
 * Clamped at zero: while the customer is still moving chips around, delivery
 * can briefly sit before pickup. Validation rejects that ordering, but this
 * label must not announce "In -1 days" in the meantime.
 */
export function turnaroundLabel(pickup: Slot, deliver: Slot): string {
  const days = Math.max(0, deliver.dayOffset - pickup.dayOffset);
  if (days === 0) return 'Same day';
  if (days === 1) return 'Next day';
  return `In ${days} days`;
}

/**
 * The wait as a full sentence, said once beneath both legs.
 *
 * The delivery picker used to carry its own note, which restated the two slot
 * summaries sitting right above it. The turnaround belongs to the pair, not to
 * one leg, so it is now stated where the pair is.
 */
export function turnaroundNote(pickup: Slot, deliver: Slot): string {
  const days = Math.max(0, deliver.dayOffset - pickup.dayOffset);
  if (days === 0) return 'Back the same day we collect it.';
  if (days === 1) return 'Back the day after we collect it.';
  return `Back ${days} days after we collect it.`;
}

/**
 * How far ahead a booking may be made.
 *
 * This used to be three days, and it was three because the day picker was four
 * chips wide — a layout constraint wearing a policy's clothes. The calendar
 * shows a month and greys what falls outside it, so the limit is now a number
 * a shop could argue with rather than a shape nobody could see.
 */
export const BOOKING_WINDOW_DAYS = 30;

/**
 * Delivery, kept after the pickup it depends on.
 *
 * A pickup moved forward can overtake the delivery already chosen. The nudge
 * only ever moves the day — the hour the customer picked survives — and it
 * clamps to the far end of the window, past which no day is selectable and the
 * leg would render pointing at nothing.
 *
 * A delivery already later than pickup is now left exactly where it was put.
 * It used to be dragged back to within three days of pickup, which quietly
 * undid a customer asking for a longer turnaround.
 */
export function keepDeliveryAfterPickup(deliver: Slot, pickup: Slot): Slot {
  const last = pickup.dayOffset + BOOKING_WINDOW_DAYS;
  if (deliver.dayOffset > last) return { dayOffset: last, hour: deliver.hour };
  if (deliver.dayOffset > pickup.dayOffset) return deliver;
  return { dayOffset: pickup.dayOffset + 1, hour: deliver.hour };
}
