/**
 * One fact this browser remembers about its guest: whether the account it
 * made has ever been given a password.
 *
 * A guest account starts with a password nobody knows. The tracking page
 * offers to set one; a guest who taps "Not now" and later loses the link would
 * otherwise be asked, on their next visit, for a password that does not exist.
 * So the offer stays up on every tracking view until a password is set. Web
 * only: the app's own accounts always have a password.
 */
const KEY = 'milaundry.guest.password-pending';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function markPasswordPending(): void {
  storage()?.setItem(KEY, '1');
}

export function isPasswordPending(): boolean {
  return storage()?.getItem(KEY) === '1';
}

export function clearPasswordPending(): void {
  storage()?.removeItem(KEY);
}
