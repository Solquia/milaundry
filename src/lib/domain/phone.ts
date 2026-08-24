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
