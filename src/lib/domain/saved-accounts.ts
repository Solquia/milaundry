/**
 * Logins already used on this device, offered under the sign-in form so nobody
 * retypes their mobile number every session.
 *
 * Only the login *identifier* is kept — never a password. A saved account is a
 * shortcut for the field, not a credential: tapping one still leaves the
 * password to type, so a lost or shared phone cannot sign in on its own.
 *
 * Accounts are canonicalised through `parseLoginId`, so "0917 123 4567",
 * "09171234567" and "+63 917 123 4567" are one entry rather than three.
 */

import { parseLoginId } from './login-id';
import { formatPhoneInput } from './phone-input';

export type SavedAccountKind = 'phone' | 'username';

export interface SavedAccount {
  /** Canonical identity: an E.164 number, or a lowercase shop username. */
  id: string;
  /** What the chip shows, and what the sign-in field is refilled with. */
  label: string;
  kind: SavedAccountKind;
}

/** Enough for a family phone or a shop tablet, short enough to scan at a glance. */
export const MAX_SAVED_ACCOUNTS = 5;

/** The saved form of a typed login, or null when it is not a login at all. */
export function toSavedAccount(loginInput: string): SavedAccount | null {
  const id = parseLoginId(loginInput);
  if (!id) return null;

  if (id.kind === 'username') {
    return { id: id.username, label: id.username, kind: 'username' };
  }

  // Shown and refilled in the local form the field expects (0917 123 4567),
  // not the E.164 form it is matched by.
  return {
    id: id.phone,
    label: `0${formatPhoneInput(id.phone)}`,
    kind: 'phone',
  };
}

/**
 * The list after signing in with `loginInput`: that account first, every other
 * account behind it, and nothing beyond the cap. Input that is not a valid
 * login leaves the list unchanged — a typo never becomes a saved account.
 */
export function rememberAccount(
  saved: readonly SavedAccount[],
  loginInput: string
): SavedAccount[] {
  const account = toSavedAccount(loginInput);
  if (!account) return [...saved];

  const others = saved.filter((entry) => entry.id !== account.id);
  return [account, ...others].slice(0, MAX_SAVED_ACCOUNTS);
}

/** The list without the named account. */
export function forgetAccount(
  saved: readonly SavedAccount[],
  id: string
): SavedAccount[] {
  return saved.filter((entry) => entry.id !== id);
}

function isSavedAccount(value: unknown): value is SavedAccount {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    entry.id.length > 0 &&
    typeof entry.label === 'string' &&
    entry.label.length > 0 &&
    (entry.kind === 'phone' || entry.kind === 'username')
  );
}

/**
 * Reads the stored list. Storage is device-local and can be anything — an
 * older shape, a truncated write, another app's key — so a bad read costs an
 * empty list, never the sign-in screen.
 */
export function parseSavedAccounts(raw: string | null): SavedAccount[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(isSavedAccount)
    .map(({ id, label, kind }) => ({ id, label, kind }))
    .slice(0, MAX_SAVED_ACCOUNTS);
}
