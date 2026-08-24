import { friendlyAuthError } from '../auth-error';

describe('friendlyAuthError', () => {
  it('replaces a synthetic auth email with the phone number', () => {
    const raw = 'Email address "639855421396@phone.milaundry.app" is invalid';
    expect(friendlyAuthError(raw, '+639855421396')).toBe(
      'Mobile number "+639855421396" is invalid'
    );
  });

  it('rewrites generic email wording to mobile number wording', () => {
    expect(friendlyAuthError('Invalid login credentials', '+639171234567')).toBe(
      'Invalid login credentials'
    );
    expect(friendlyAuthError('Email not confirmed', '+639171234567')).toBe(
      'Mobile number not confirmed'
    );
  });

  it('maps already-registered errors to a phone message', () => {
    expect(friendlyAuthError('User already registered', '+639171234567')).toBe(
      'An account with this mobile number already exists.'
    );
  });

  it('hides any remaining synthetic email mention', () => {
    const raw = 'Something failed for 639171234567@phone.milaundry.app today';
    expect(friendlyAuthError(raw, '+639171234567')).not.toContain('@');
  });
});
