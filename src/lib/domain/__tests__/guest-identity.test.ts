import {
  friendlyGuestError,
  parseGuestSessionResponse,
  validateGuestDetails,
  welcomeBackNotice,
} from '../guest-identity';

describe('validateGuestDetails', () => {
  it('accepts a name and a national mobile number, returning E.164', () => {
    expect(validateGuestDetails('  Juan Dela Cruz ', '917 123 4567')).toEqual({
      ok: true,
      name: 'Juan Dela Cruz',
      phone: '+639171234567',
    });
  });

  it('asks for a name before it asks for a number', () => {
    const result = validateGuestDetails(' ', '917 123 4567');
    expect(result).toMatchObject({ ok: false, field: 'name' });
  });

  it('refuses a one-letter name', () => {
    expect(validateGuestDetails('J', '917 123 4567')).toMatchObject({ ok: false, field: 'name' });
  });

  it('refuses an incomplete number', () => {
    expect(validateGuestDetails('Juan', '917 123')).toMatchObject({ ok: false, field: 'phone' });
  });
});

describe('parseGuestSessionResponse', () => {
  it('reads an existing-account answer', () => {
    expect(parseGuestSessionResponse({ exists: true })).toEqual({ kind: 'needs-password' });
  });

  it('reads a fresh session token', () => {
    expect(parseGuestSessionResponse({ token_hash: 'abc' })).toEqual({
      kind: 'token',
      tokenHash: 'abc',
    });
  });

  it('throws on anything else rather than signing nobody in', () => {
    expect(() => parseGuestSessionResponse({})).toThrow();
    expect(() => parseGuestSessionResponse(null)).toThrow();
    expect(() => parseGuestSessionResponse({ token_hash: 7 })).toThrow();
  });
});

describe('copy', () => {
  it('names the number that already has an account', () => {
    expect(welcomeBackNotice('+639171234567')).toContain('0917 123 4567');
  });

  it('turns a rate limit into a sentence about waiting', () => {
    expect(friendlyGuestError('Too many attempts (429)')).toMatch(/wait/i);
    expect(friendlyGuestError('rate limit exceeded')).toMatch(/wait/i);
  });

  it('turns a wrong password into a sentence about the password', () => {
    expect(friendlyGuestError('Invalid login credentials')).toMatch(/password/i);
  });

  it('falls through to the booking wording for everything else', () => {
    expect(friendlyGuestError('fetch failed')).toMatch(/connection/i);
  });
});
