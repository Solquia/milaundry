import { normalizePhone, isValidPhone } from '../phone';

describe('normalizePhone (PH default)', () => {
  it('normalizes 09xx mobile format to E.164', () => {
    expect(normalizePhone('09171234567')).toBe('+639171234567');
  });

  it('normalizes bare 9xx format to E.164', () => {
    expect(normalizePhone('9171234567')).toBe('+639171234567');
  });

  it('passes through already-E.164 numbers', () => {
    expect(normalizePhone('+639171234567')).toBe('+639171234567');
  });

  it('normalizes 63-prefixed numbers without plus', () => {
    expect(normalizePhone('639171234567')).toBe('+639171234567');
  });

  it('strips spaces, dashes and parentheses', () => {
    expect(normalizePhone('0917 123-4567')).toBe('+639171234567');
    expect(normalizePhone('(0917) 123 4567')).toBe('+639171234567');
  });

  it('accepts other-country E.164 numbers as-is', () => {
    expect(normalizePhone('+14155552671')).toBe('+14155552671');
  });

  it('returns null for invalid input', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone('abc')).toBeNull();
    expect(normalizePhone('0917123')).toBeNull(); // too short
    expect(normalizePhone('091712345678999')).toBeNull(); // too long
  });
});

describe('isValidPhone', () => {
  it('is true for normalizable numbers', () => {
    expect(isValidPhone('09171234567')).toBe(true);
  });
  it('is false otherwise', () => {
    expect(isValidPhone('123')).toBe(false);
  });
});
