import { phoneToAuthEmail } from '../phone-email';

describe('phoneToAuthEmail', () => {
  it('maps an E.164 phone to a deterministic synthetic email on a resolvable domain', () => {
    // Domain must resolve in DNS (Supabase validates it) but never receive
    // mail; example.com is IANA-reserved and satisfies both.
    expect(phoneToAuthEmail('+639171234567')).toBe('639171234567@example.com');
  });

  it('produces valid email local parts (digits only, no plus)', () => {
    expect(phoneToAuthEmail('+14155552671')).toBe('14155552671@example.com');
  });

  it('is deterministic for the same input', () => {
    expect(phoneToAuthEmail('+639171234567')).toBe(phoneToAuthEmail('+639171234567'));
  });

  it('throws for non-E.164 input', () => {
    expect(() => phoneToAuthEmail('09171234567')).toThrow();
    expect(() => phoneToAuthEmail('')).toThrow();
    expect(() => phoneToAuthEmail('abc')).toThrow();
  });
});
