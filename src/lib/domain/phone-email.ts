// Supabase phone auth requires a paid SMS provider. Instead we keep the phone
// number as the user-facing identity and derive a deterministic synthetic
// email from it for Supabase email+password auth (no SMS needed).
// The domain must resolve in DNS (Supabase rejects unresolvable domains with
// email_address_invalid) but must never receive mail; example.com is
// IANA-reserved and guarantees both. Overridable without a code change.
const AUTH_EMAIL_DOMAIN =
  process.env.EXPO_PUBLIC_AUTH_EMAIL_DOMAIN ?? 'example.com';
const E164_RE = /^\+[1-9]\d{7,14}$/;

export function phoneToAuthEmail(e164Phone: string): string {
  if (!E164_RE.test(e164Phone)) {
    throw new Error(`Not an E.164 phone number: ${e164Phone}`);
  }
  return `${e164Phone.slice(1)}@${AUTH_EMAIL_DOMAIN}`;
}
