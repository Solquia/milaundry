import { normalizePhone } from './phone';

// The auth screens show a fixed "+63" next to the field, so the user only ever
// types the national part. These helpers keep what is typed and what is sent to
// Supabase in sync: display stays national (917 123 4567), storage stays E.164.
export const PH_DIAL_CODE = '+63';

const NATIONAL_LENGTH = 10;
const GROUP_SIZES = [3, 3, 4];
// PH mobile numbers are always 10 national digits starting with 9.
const PH_MOBILE_RE = /^9\d{9}$/;

/** Digits of the national number, with any country/trunk prefix removed. */
function toNationalDigits(input: string): string {
  const digits = input.replace(/\D/g, '');
  const withoutCountryCode = digits.startsWith('639') ? digits.slice(2) : digits;
  const withoutTrunk = withoutCountryCode.startsWith('0')
    ? withoutCountryCode.slice(1)
    : withoutCountryCode;
  return withoutTrunk.slice(0, NATIONAL_LENGTH);
}

/** Formats what the user types as `917 123 4567`, dropping any +63/0 prefix. */
export function formatPhoneInput(input: string): string {
  const digits = toNationalDigits(input);
  const groups: string[] = [];
  let offset = 0;
  for (const size of GROUP_SIZES) {
    if (offset >= digits.length) break;
    groups.push(digits.slice(offset, offset + size));
    offset += size;
  }
  return groups.join(' ');
}

/** Converts the field value into an E.164 number, or null when incomplete. */
export function phoneInputToE164(input: string): string | null {
  const digits = toNationalDigits(input);
  if (!PH_MOBILE_RE.test(digits)) return null;
  return normalizePhone(`${PH_DIAL_CODE}${digits}`);
}
