/**
 * The till: what one tap on the counter means.
 *
 * The old POS asked the merchant to open a category, tap a service, then work a
 * `− +` stepper half a kilo at a time, with the running total somewhere below
 * the fold. A till does the opposite: the menu is a grid of things you tap, a
 * tap *is* the quantity for anything you can count, and the total never leaves
 * the bottom of the screen.
 *
 * Only weight breaks the rule, because nobody can tap 6.5 kg. A per-kg tile
 * therefore hands off to the scale instead of adding anything — the one place
 * the flow stops to ask, and it asks with a ruler rather than a stepper.
 */
import { formatMoney } from './money';
import { quantityCeiling } from './order-quantity';
import { formatQuantity } from './price-label';
import { estimateLineTotal, type Service } from './pricing';
import type { PaymentMethod } from './walk-in-order';

export type TileTap = { kind: 'weigh' } | { kind: 'set'; quantity: number };

/** What happens when a service tile is tapped with `current` already on the ticket. */
export function tapTile(service: Service, current: number): TileTap {
  if (service.unit === 'per_kg') return { kind: 'weigh' };
  const base = Number.isFinite(current) && current > 0 ? current : 0;
  const next = Math.min(quantityCeiling(service.unit), base + 1);
  return { kind: 'set', quantity: next };
}

/**
 * The way back: a second control on a chosen tile, so a mis-tap to ×3 is undone
 * where it happened instead of by clearing the whole ticket. Counted things
 * step down by one; a flat or weighed line has no smaller version, so it comes
 * off entirely.
 */
export function untapTile(service: Service, current: number): number {
  if (!Number.isFinite(current) || current <= 0) return 0;
  if (service.unit !== 'per_item') return 0;
  return Math.max(0, current - 1);
}

/** The mark a tile wears once it is on the ticket, or null when it is not. */
export function tileBadge(service: Service, quantity: number | undefined): string | null {
  if (quantity === undefined || !Number.isFinite(quantity) || quantity <= 0) return null;
  if (service.unit === 'flat') return 'Added';
  if (service.unit === 'per_kg') return formatQuantity('per_kg', quantity);
  return `×${quantity}`;
}

/** The loads a counter sees most; the shop's minimum is spliced in ahead of them. */
export const STANDARD_LOADS_KG: readonly number[] = [3, 5, 8, 12];

function billableMinimum(service: Service): number {
  if (service.unit === 'flat') return 0;
  const minimum = service.min_quantity ?? 0;
  return Number.isFinite(minimum) && minimum > 0 ? minimum : 0;
}

/**
 * Quick-weight chips for the scale sheet: the minimum first, then the standard
 * loads, nothing below the minimum and nothing the scale cannot read.
 */
export function quickWeights(service: Service, maxKg: number): number[] {
  const minimum = billableMinimum(service);
  const candidates = [minimum, ...STANDARD_LOADS_KG].filter(
    (kg) => kg > 0 && kg >= minimum && kg <= maxKg
  );
  return [...new Set(candidates)].sort((a, b) => a - b);
}

/** The scale sheet's one button, quoting the charge `estimateLineTotal` will make. */
export function scaleSheetCta(service: Service, kg: number, isEditing: boolean): string {
  if (!Number.isFinite(kg) || kg <= 0) return 'Set a weight first';
  const charge = formatMoney(estimateLineTotal(service, kg));
  const amount = formatQuantity('per_kg', kg);
  return isEditing ? `Update to ${amount} · ${charge}` : `Add ${amount} · ${charge}`;
}

/** How many lines on the ticket carry something. */
export function ticketCount(quantities: Readonly<Record<string, number>>): number {
  return Object.values(quantities).filter((qty) => Number.isFinite(qty) && qty > 0).length;
}

export function ticketCountLabel(count: number): string {
  if (count <= 0) return 'No items yet';
  return `${count} ${count === 1 ? 'item' : 'items'}`;
}

/**
 * The footer button. It carries the total so the merchant reads the price in
 * the same glance as the action, and it says what to do when there is nothing
 * to charge yet, so a disabled button is never a dead end.
 */
export function chargeLabel(count: number, total: number | null): string {
  if (count <= 0) return 'Tap a service to start';
  if (total === null) return 'Charge';
  return `Charge ${formatMoney(total)}`;
}

const PAYMENT_ICONS: Record<PaymentMethod, string> = {
  cash: 'cash-outline',
  gcash: 'phone-portrait-outline',
  maya: 'wallet-outline',
  card: 'card-outline',
  bank_transfer: 'business-outline',
  other: 'ellipsis-horizontal-circle-outline',
};

/** Ionicons glyph for a payment method tile. */
export function paymentMethodIcon(method: PaymentMethod): string {
  return PAYMENT_ICONS[method];
}
