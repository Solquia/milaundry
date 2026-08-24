import { normalizePhone } from './phone';

export const MIN_PASSWORD_LENGTH = 8;

export type CredentialsResult =
  | { ok: true; phone: string }
  | { ok: false; field: 'phone' | 'password'; message: string };

export function validateCredentials(
  phoneInput: string,
  password: string
): CredentialsResult {
  const phone = normalizePhone(phoneInput);
  if (!phone) {
    return {
      ok: false,
      field: 'phone',
      message: 'Enter a valid mobile number (e.g. 0917 123 4567).',
    };
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      field: 'password',
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  return { ok: true, phone };
}
