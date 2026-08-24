import { validateCredentials, MIN_PASSWORD_LENGTH } from '../credentials';

describe('validateCredentials', () => {
  it('accepts a valid PH phone and strong-enough password', () => {
    const result = validateCredentials('09171234567', 'secret123');
    expect(result).toEqual({
      ok: true,
      phone: '+639171234567',
    });
  });

  it('rejects an invalid phone number with a phone error', () => {
    const result = validateCredentials('12345', 'secret123');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('phone');
  });

  it('rejects a too-short password with a password error', () => {
    const short = 'a'.repeat(MIN_PASSWORD_LENGTH - 1);
    const result = validateCredentials('09171234567', short);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('password');
  });

  it('rejects an empty password', () => {
    const result = validateCredentials('09171234567', '');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('password');
  });

  it('requires at least 8 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(validateCredentials('09171234567', '12345678').ok).toBe(true);
  });
});
