/**
 * What the customer is told when booking cannot proceed.
 *
 * The booking screen used to collapse every failure into one sentence —
 * "Service not found" — so a dropped signal on mobile data read as "your
 * laundry service does not exist". Each cause now gets its own message, and
 * only the recoverable one offers a retry.
 *
 * Sibling mappers: `auth-error.ts` (sign-in), `admin-error.ts` (superadmin).
 */

/** A blocked booking, phrased for the customer. */
export type CatalogProblem = {
  title: string;
  body: string;
  canRetry: boolean;
};

const LOST_SHOP: CatalogProblem = {
  title: 'We lost track of the shop',
  body: 'Go back and open the shop again to book this service.',
  canRetry: false,
};

const CANNOT_LOAD_PRICES: CatalogProblem = {
  title: "We couldn't load this shop's prices",
  body: 'Check your connection and try again.',
  canRetry: true,
};

const OFF_MENU: CatalogProblem = {
  title: 'This service is off the menu right now',
  body: 'The shop may have updated its price list. Go back and pick another service.',
  canRetry: false,
};

const SHOP_UNAVAILABLE: CatalogProblem = {
  title: "This shop isn't taking bookings",
  body: 'It may be closed for now or no longer on MiLaundry. Pick another laundry shop.',
  canRetry: false,
};

/** A rebook whose service was dropped: name what it was, not "this service". */
function goneSince(serviceName: string): CatalogProblem {
  return {
    title: `${serviceName} isn't offered anymore`,
    body: 'The shop changed its price list since your last order. Open the shop to pick another service.',
    canRetry: false,
  };
}

/**
 * The problem blocking the booking screen, or null when it can render.
 *
 * A load failure outranks a missing service: when the price list never arrived,
 * "we couldn't reach the shop" is the true cause and "off the menu" is a guess.
 * A closed shop outranks a missing service for the same reason: its whole menu
 * is off, not one line of it.
 */
export function describeCatalogProblem(input: {
  hasShopId: boolean;
  loadError: Error | null;
  isServiceFound: boolean;
  /** False once the shop is switched off or hidden; undefined while unknown. */
  isShopAvailable?: boolean;
  /** Set when this booking is a "Book again" of a named service. */
  rebookServiceName?: string;
}): CatalogProblem | null {
  if (!input.hasShopId) return LOST_SHOP;
  if (input.loadError) return CANNOT_LOAD_PRICES;
  if (input.isShopAvailable === false) return SHOP_UNAVAILABLE;
  if (!input.isServiceFound) {
    return input.rebookServiceName ? goneSince(input.rebookServiceName) : OFF_MENU;
  }
  return null;
}

const CONNECTION_RE = /network|fetch|timeout|offline|connection|econnrefused/i;

/** Postgres, PostgREST, and HTTP detail that means nothing to a customer. */
const TECHNICAL_RE =
  /[{}[\]]|\bPGRST\w*|\b[45]\d{2}\b|violates|constraint|\brelation\b|\bcolumn\b|null value|duplicate key|\bsyntax\b|\bundefined\b|\bnull\b/i;

/**
 * PostgREST's answer when the database is missing something the app calls —
 * a shop whose backend has not had the online-booking migration applied. The
 * signature it quotes back is meaningless to a customer, and no amount of
 * retrying will help, so the message names the one thing that does: the shop.
 */
const MISSING_BACKEND_RE = /schema cache|could not find the (function|table|column)/i;

const BOOKING_FALLBACK = "We couldn't place your booking. Please try again.";
const BOOKING_OFFLINE = "We couldn't reach the shop. Check your connection and try again.";
const BOOKING_UNAVAILABLE =
  "This shop can't take online bookings yet. Please contact the shop to place your order.";

const SERVER_REFUSALS: readonly (readonly [RegExp, string])[] = [
  [/not registered with this shop/i, "You're not connected to this shop yet — open the shop to connect, then book."],
  [/unknown service/i, "One of these services isn't offered anymore. Go back and pick again."],
  [/delivery orders need an address/i, 'Enter the pickup & delivery address.'],
  [/delivery must come after pickup/i, 'Delivery must come after pickup.'],
];

/** Whether a failure means the request may never have reached the shop, or its answer never came back. */
export function isConnectionError(rawMessage: string): boolean {
  return CONNECTION_RE.test(rawMessage);
}

/**
 * Turns a backend failure into something the customer can act on, without
 * inventing a cause the system cannot know. A message that already reads like a
 * sentence — a shop's own "closed for the day" — is passed through untouched.
 */
export function friendlyBookingError(rawMessage: string): string {
  const message = rawMessage.trim();
  if (!message) return BOOKING_FALLBACK;
  // place_order's own refusals, in words the customer can act on. Checked
  // first: "unknown service: <uuid>" would otherwise be shown verbatim.
  const refusal = SERVER_REFUSALS.find(([pattern]) => pattern.test(message));
  if (refusal) return refusal[1];
  if (CONNECTION_RE.test(message)) return BOOKING_OFFLINE;
  // Checked before TECHNICAL_RE: this failure has a cause worth naming, where
  // the generic "please try again" would send the customer in circles.
  if (MISSING_BACKEND_RE.test(message)) return BOOKING_UNAVAILABLE;
  if (TECHNICAL_RE.test(message)) return BOOKING_FALLBACK;
  return message;
}
