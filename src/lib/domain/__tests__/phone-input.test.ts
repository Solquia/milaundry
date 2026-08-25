import {
  PH_DIAL_CODE,
  formatPhoneInput,
  phoneInputToE164,
} from '../phone-input';

describe('PH_DIAL_CODE', () => {
  it('is the Philippines dial code shown next to the input', () => {
    expect(PH_DIAL_CODE).toBe('+63');
  });
});

describe('formatPhoneInput', () => {
  it('groups a national number as 3-3-4', () => {
    expect(formatPhoneInput('9171234567')).toBe('917 123 4567');
  });

  it('formats partial input without padding', () => {
    expect(formatPhoneInput('9')).toBe('9');
    expect(formatPhoneInput('917')).toBe('917');
    expect(formatPhoneInput('9171')).toBe('917 1');
    expect(formatPhoneInput('917123')).toBe('917 123');
    expect(formatPhoneInput('9171234')).toBe('917 123 4');
  });

  it('drops the trunk prefix when the user types 09xx', () => {
    expect(formatPhoneInput('09171234567')).toBe('917 123 4567');
  });

  it('drops a pasted 63 country code', () => {
    expect(formatPhoneInput('639171234567')).toBe('917 123 4567');
  });

  it('drops a pasted +63 country code', () => {
    expect(formatPhoneInput('+639171234567')).toBe('917 123 4567');
  });

  it('strips separators and letters', () => {
    expect(formatPhoneInput('0917-123 4567')).toBe('917 123 4567');
    expect(formatPhoneInput('(0917) 123 4567')).toBe('917 123 4567');
    expect(formatPhoneInput('abc')).toBe('');
  });

  it('caps input at 10 national digits', () => {
    expect(formatPhoneInput('91712345678999')).toBe('917 123 4567');
  });

  it('returns an empty string for empty input', () => {
    expect(formatPhoneInput('')).toBe('');
  });
});

describe('phoneInputToE164', () => {
  it('prefixes +63 onto a formatted national number', () => {
    expect(phoneInputToE164('917 123 4567')).toBe('+639171234567');
  });

  it('prefixes +63 onto a raw national number', () => {
    expect(phoneInputToE164('9171234567')).toBe('+639171234567');
  });

  it('still works when the user typed the trunk prefix', () => {
    expect(phoneInputToE164('0917 123 4567')).toBe('+639171234567');
  });

  it('returns null for incomplete numbers', () => {
    expect(phoneInputToE164('917 123')).toBeNull();
    expect(phoneInputToE164('')).toBeNull();
  });

  it('returns null when the national number is not a PH mobile', () => {
    expect(phoneInputToE164('123 456 7890')).toBeNull();
  });
});
