// Auth runs on synthetic emails (see phone-email.ts) — errors coming back from
// Supabase must never leak them; users only ever typed a mobile number.
const SYNTHETIC_EMAIL_RE = /\d{8,15}@[\w.-]*milaundry[\w.-]*/g;
const ANY_AUTH_EMAIL_RE = /\d{8,15}@[\w.-]+\.[a-z]{2,}/gi;

export function friendlyAuthError(rawMessage: string, phone: string): string {
  if (/already registered/i.test(rawMessage)) {
    return 'An account with this mobile number already exists.';
  }

  return rawMessage
    .replace(SYNTHETIC_EMAIL_RE, phone)
    .replace(ANY_AUTH_EMAIL_RE, phone)
    .replace(/\bEmail address\b/g, 'Mobile number')
    .replace(/\bEmail\b/g, 'Mobile number')
    .replace(/\bemail\b/g, 'mobile number');
}
