/**
 * The shop's own scanner.
 *
 * Behind the counter a code means one thing: "whose is this?" A bag tag and a
 * customer's receipt both answer with an order, and both open it on the order
 * screen. Neither is claimed: the receipt's token is dropped on the floor here,
 * because a shop that claimed its customers' orders would take them off the
 * customers' phones.
 *
 * The shop cannot open another shop's order; the database refuses the read,
 * and that refusal is how a stray tag from next door is recognised.
 */
import { parseQrPayload, parseTagCode } from './qr';

export type MerchantCode =
  | { kind: 'order'; orderId: string }
  | { kind: 'counter' }
  | { kind: 'unknown' };

export function readMerchantCode(raw: string): MerchantCode {
  const code = raw.trim();
  if (!code) return { kind: 'unknown' };

  const tagOrder = parseTagCode(code);
  if (tagOrder) return { kind: 'order', orderId: tagOrder };

  const payload = parseQrPayload(code);
  if (payload?.type === 'order') return { kind: 'order', orderId: payload.id };
  if (payload?.type === 'shop') return { kind: 'counter' };
  return { kind: 'unknown' };
}

export function merchantScanRoute(orderId: string): string {
  return `/(merchant)/order/${orderId}`;
}

export function merchantScanCopy() {
  return {
    title: 'Scan a tag',
    hint: 'Point at the tag on a bag, or a customer’s receipt, to open that order.',
    camera: 'MiLaundry uses the camera to read the tags on your bags.',
    counter: 'That is your counter code. It is for customers to connect to your shop.',
    unknown: 'That isn’t a MiLaundry tag or receipt.',
    looking: 'Opening the order…',
    typedTitle: 'Enter the tag code',
    typedHint: 'Type or paste the link under the square, or use a barcode scanner.',
  };
}

function isNetworkFailure(message: string): boolean {
  return /network request failed|fetch failed|failed to fetch/i.test(message);
}

/** No row back means the order is not this shop's to see, or is gone. */
export function merchantScanFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (isNetworkFailure(message)) return 'Could not reach the server. Check your signal and try again.';
  if (/no\) rows|0 rows|PGRST116/i.test(message)) {
    return 'This tag belongs to another shop, or the order was removed.';
  }
  return message || 'Could not open that order. Try again.';
}
