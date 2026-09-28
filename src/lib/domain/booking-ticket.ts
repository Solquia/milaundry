/**
 * The booking as one ticket: a line per decision, each already answered with
 * a sensible default and opened only when the customer wants to change it.
 *
 * These are the words each line reads as, and which page the booking opens on.
 */
import type { BookingStep } from '@/lib/domain/booking-seed';
import type { PickedAddon } from '@/lib/domain/shop-addons';
import type { Fulfillment } from '@/lib/domain/walk-in-order';

/**
 * The booking is two pages: the laundry (what goes in the drum) and delivery
 * (how it gets there and back, and when). Split so a first-timer answers one
 * kind of question at a time instead of facing the whole form at once.
 */
export type BookingPage = 'laundry' | 'delivery';

const NAMES_SHOWN = 2;

/**
 * Where the booking opens. A fresh booking starts at the laundry; a book-again
 * already knows its load, so it opens on delivery — ready to confirm, or to fix
 * an address that no longer holds.
 */
export function firstPage(step: BookingStep): BookingPage {
  return step === 'items' ? 'laundry' : 'delivery';
}

/** The shelf picks in one line: two names, then a count. */
export function addonSummary(picked: readonly PickedAddon[]): string {
  if (picked.length === 0) return 'None';
  const names = picked
    .slice(0, NAMES_SHOWN)
    .map(({ addon, quantity }) => (quantity > 1 ? `${addon.name} ×${quantity}` : addon.name));
  const rest = picked.length - NAMES_SHOWN;
  return rest > 0 ? `${names.join(', ')} +${rest} more` : names.join(', ');
}

/** Where the laundry changes hands, in one line. */
export function placeSummary(fulfillment: Fulfillment, address: string): string {
  if (fulfillment === 'pickup') return 'Drop off at shop';
  const trimmed = address.trim();
  return trimmed.length > 0 ? trimmed : 'Add your address';
}
