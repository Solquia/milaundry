/**
 * What the shop owner is told when something fails.
 *
 * The merchant screens used to print the backend's own words — Postgres
 * constraint names, PostgREST codes, raw JSON — straight onto the screen, with
 * nothing to press. To an owner who is not technical that is not an error
 * message, it is noise that makes the app feel broken.
 *
 * Every failure now says what did not happen, in the words they would use, and
 * what to do next. A message the shop's own rules produced ("This order was
 * already cancelled") is worth reading, so it passes through untouched.
 *
 * Sibling mappers: `booking-error.ts` (customer), `auth-error.ts` (sign-in),
 * `admin-error.ts` (superadmin).
 */

/** The thing the owner was trying to do when it failed. */
export type MerchantAction =
  | 'load-orders'
  | 'load-prices'
  | 'load-shop'
  | 'load-earnings'
  | 'open-order'
  | 'save-payment'
  | 'move-order'
  | 'save-price'
  | 'save-order'
  | 'save-branding'
  | 'save-cover'
  | 'save-location'
  | 'locate-me';

const FALLBACKS: Record<MerchantAction, string> = {
  'load-orders': 'Your orders did not load. Try again in a moment.',
  'load-prices': 'Your price list did not load. Try again in a moment.',
  'load-shop': 'We could not reach your shop. Try again in a moment.',
  'load-earnings': 'Your earnings did not load. Try again in a moment.',
  'open-order': 'This order did not open. Try again in a moment.',
  'save-payment': 'The payment was not recorded. Try again in a moment.',
  'move-order': 'The order did not move. Try again in a moment.',
  'save-price': 'The price was not saved. Try again in a moment.',
  'save-order': 'The order was not saved. Try again in a moment.',
  'save-branding': 'Your shopfront was not saved. Try again in a moment.',
  'save-cover': 'Your shop photo was not saved. Try again in a moment.',
  'save-location': 'Your shop location was not saved. Try again in a moment.',
  // Not a server fault, so not "try again in a moment": the fix is in the
  // phone's settings, or a tap on the map instead.
  'locate-me':
    'We could not find your location. Turn on location and try again, or tap the map instead.',
};

const OFFLINE = 'No internet connection. Check your signal and try again.';

const CONNECTION_RE = /network|fetch|timeout|offline|connection|econnrefused/i;

/** Postgres, PostgREST, and HTTP detail that means nothing to a shop owner. */
const TECHNICAL_RE =
  /[{}[\]]|\bPGRST\w*|\b[45]\d{2}\b|violates|constraint|\brelation\b|\bcolumn\b|null value|duplicate key|\bsyntax\b|\bundefined\b|\bnull\b/i;

export function friendlyMerchantError(action: MerchantAction, rawMessage: string): string {
  const message = rawMessage.trim();
  if (!message) return FALLBACKS[action];
  if (CONNECTION_RE.test(message)) return OFFLINE;
  if (TECHNICAL_RE.test(message)) return FALLBACKS[action];
  return message;
}
