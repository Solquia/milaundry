/**
 * The tag on the bag.
 *
 * The receipt goes home with the customer; the tag stays with the laundry.
 * It is what the counter reads when a bag comes off the folding table: whose
 * load, how to reach them, and which bag of how many. So the name is printed
 * as large as the paper allows, and nothing about money is printed at all.
 *
 * The QR on it is not the receipt's. The receipt QR carries the claim token,
 * and anyone who scans it can put the order on their account; a tag passes
 * through too many hands for that. The tag QR is the order id alone, and it
 * opens the order only for someone signed in to the shop that owns it.
 */

import type { OrderWithDetails } from '../api';
import { docketNumber } from './docket';
import { buildTagQr } from './qr';
import { type PaperColumns, type ReceiptLine, type ReceiptShop, twoColumn, whenLabel } from './receipt';

/** More than this is a slipped thumb on the stepper, not a load. */
export const MAX_TAGS = 20;

export interface TagOptions {
  columns: PaperColumns;
  count: number;
}

export function clampTagCount(count: number): number {
  if (!Number.isFinite(count)) return 1;
  return Math.min(MAX_TAGS, Math.max(1, Math.floor(count)));
}

/** Double-size text takes two columns a character. */
function clip(value: string, width: number): string {
  const trimmed = value.trim();
  return trimmed.length > width ? trimmed.slice(0, width) : trimmed;
}

function tag(
  order: OrderWithDetails,
  shop: Pick<ReceiptShop, 'name'>,
  columns: PaperColumns,
  index: number,
  count: number
): ReceiptLine[] {
  const bigWidth = Math.floor(columns / 2);
  const phone = order.customer_phone?.trim();
  const when = whenLabel(order.created_at);
  return [
    { kind: 'text', text: clip(shop.name, columns), align: 'center', bold: true },
    { kind: 'rule' },
    { kind: 'text', text: docketNumber(order.id), bold: true, big: true },
    { kind: 'text', text: clip(order.customer_name, bigWidth), bold: true, big: true },
    ...(phone ? [{ kind: 'text', text: clip(phone, columns), bold: true } as const] : []),
    { kind: 'text', text: twoColumn(when ? `In ${when}` : '', `Tag ${index}/${count}`, columns) },
    { kind: 'feed', lines: 1 },
    { kind: 'qr', value: buildTagQr(order.id) },
    { kind: 'text', text: 'Shop use: scan to open order', align: 'center' },
    { kind: 'feed', lines: 3 },
    { kind: 'cut' },
  ];
}

/** One tag per bag, numbered, each cut off the roll on its own. */
export function buildTags(
  order: OrderWithDetails,
  shop: Pick<ReceiptShop, 'name'>,
  options: TagOptions
): ReceiptLine[] {
  const count = clampTagCount(options.count);
  return Array.from({ length: count }, (_, i) => tag(order, shop, options.columns, i + 1, count)).flat();
}
