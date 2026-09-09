const E164_RE = /^\+[1-9]\d{7,14}$/;
const PH_MOBILE_RE = /^9\d{9}$/;

export function normalizePhone(input: string): string | null {
  if (!input) return null;

  const cleaned = input.replace(/[\s\-().]/g, '');

  if (cleaned.startsWith('+')) {
    return E164_RE.test(cleaned) ? cleaned : null;
  }

  if (!/^\d+$/.test(cleaned)) return null;

  // PH local formats → +63
  if (cleaned.startsWith('09') && PH_MOBILE_RE.test(cleaned.slice(1))) {
    return `+63${cleaned.slice(1)}`;
  }
  if (PH_MOBILE_RE.test(cleaned)) {
    return `+63${cleaned}`;
  }
  if (cleaned.startsWith('63') && PH_MOBILE_RE.test(cleaned.slice(2))) {
    return `+${cleaned}`;
  }

  return null;
}

export function isValidPhone(input: string): boolean {
  return normalizePhone(input) !== null;
}

/**
 * The digits of a number as a person would type them at the counter, for
 * matching a search against what is stored. `+63 917 123 4567` and `0917 123`
 * both come out starting `917`, so a fragment typed either way still finds
 * the customer. Not a validator: any digits at all are fair game here.
 */
export function searchDigits(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('63') && digits.length > 10) return digits.slice(2);
  if (digits.startsWith('0')) return digits.slice(1);
  return digits;
}
