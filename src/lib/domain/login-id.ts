import { phoneToAuthEmail } from './phone-email';
import { phoneInputToE164 } from './phone-input';

// One sign-in box, two identities: customers use their mobile number, shop
// accounts use the branded username generated with their shop. Usernames must
// contain a letter, so they can never collide with the digits-only synthetic
// emails that phone auth uses.
const AUTH_EMAIL_DOMAIN =
  process.env.EXPO_PUBLIC_AUTH_EMAIL_DOMAIN ?? 'example.com';

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export type LoginId =
  | { kind: 'phone'; phone: string }
  | { kind: 'username'; username: string };

export function parseLoginId(input: string): LoginId | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const looksLikePhone = /^[+\d][\d\s()-]*$/.test(trimmed);
  if (looksLikePhone) {
    const phone = phoneInputToE164(trimmed);
    return phone ? { kind: 'phone', phone } : null;
  }

  const username = trimmed.toLowerCase();
  if (!USERNAME_RE.test(username) || !/[a-z]/.test(username)) return null;
  return { kind: 'username', username };
}

export function loginIdToAuthEmail(id: LoginId): string {
  if (id.kind === 'phone') return phoneToAuthEmail(id.phone);
  return `${id.username}@${AUTH_EMAIL_DOMAIN}`;
}
