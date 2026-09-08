/**
 * The words on a basket that lives inside a price list.
 *
 * The shop's web page lets a visitor build the order while reading the
 * prices. Two things have to be said back to them as they do: what each
 * line now costs for the quantity they chose, and what the one button at the
 * bottom will book.
 */
import { formatMoneyCompact } from './money';
import { formatQuantity } from './price-label';
import type { CartLine } from './web-cart';

/** The footer button: an invitation while empty, the order once it is not. */
export function bookButtonLabel(count: number, total: number): string {
  if (count <= 0) return 'Book online';
  return `Book ${count} ${count === 1 ? 'item' : 'items'} · ${formatMoneyCompact(total)}`;
}

/** `₱528 for 3 kg`; a flat line is just its price. */
export function lineSummary(line: CartLine): string {
  const money = formatMoneyCompact(line.subtotal);
  if (line.service.unit === 'flat') return money;
  return `${money} for ${formatQuantity(line.service.unit, line.quantity)}`;
}
