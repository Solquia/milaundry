/**
 * Who is booking, when all we ask for is a name and a number.
 *
 * A web visitor has no account and should not need one to book. The checkout
 * asks for a name and a mobile number, and the `web-guest-session` edge
 * function turns that into a real account with a session. The one exception
 * is a number that already has an account: then the page asks for the
 * password, because typing someone's number must never sign in as them.
 *
 * This module owns the validation and the words. `api.ts` owns the calls.
 */
import { friendlyBookingError } from './booking-error';
import { PH_DIAL_CODE, formatPhoneInput, phoneInputToE164 } from './phone-input';

const MIN_NAME_LENGTH = 2;

export type GuestDetailsResult =
  | { ok: true; name: string; phone: string }
  | { ok: false; field: 'name' | 'phone'; message: string };

/** Name first, then number: the order the form shows them in. */
export function validateGuestDetails(nameInput: string, phoneInput: string): GuestDetailsResult {
  const name = nameInput.trim();
  if (name.length < MIN_NAME_LENGTH) {
    return { ok: false, field: 'name', message: 'Enter your name so the shop knows whose laundry it is.' };
  }
  const phone = phoneInputToE164(phoneInput);
  if (!phone) {
    return {
      ok: false,
      field: 'phone',
      message: `Enter a valid mobile number (e.g. ${PH_DIAL_CODE} 917 123 4567).`,
    };
  }
  return { ok: true, name, phone };
}

export type GuestSessionAnswer =
  | { kind: 'needs-password' }
  | { kind: 'token'; tokenHash: string };

/**
 * What the edge function said. Anything malformed throws: a page that cannot
 * tell whether it got a session must not carry on as if it had.
 */
export function parseGuestSessionResponse(body: unknown): GuestSessionAnswer {
  if (body && typeof body === 'object') {
    const record = body as { exists?: unknown; token_hash?: unknown };
    if (record.exists === true) return { kind: 'needs-password' };
    if (typeof record.token_hash === 'string' && record.token_hash) {
      return { kind: 'token', tokenHash: record.token_hash };
    }
  }
  throw new Error('The sign-in service gave an unexpected answer.');
}

/** The number as the customer would say it: 0917 123 4567. */
function nationalPhone(phone: string): string {
  return `0${formatPhoneInput(phone)}`;
}

export function welcomeBackNotice(phone: string): string {
  return `${nationalPhone(phone)} already has a MiLaundry account. Enter its password to continue.`;
}

const RATE_LIMIT_RE = /429|too many|rate limit/i;
const WRONG_PASSWORD_RE = /invalid login credentials/i;

/** Guest sign-in failures the booking wording does not cover. */
export function friendlyGuestError(rawMessage: string): string {
  if (RATE_LIMIT_RE.test(rawMessage)) {
    return 'Too many tries from this number. Wait a minute and try again.';
  }
  if (WRONG_PASSWORD_RE.test(rawMessage)) {
    return 'That password is not right. Try again, or book with a different number.';
  }
  return friendlyBookingError(rawMessage);
}
