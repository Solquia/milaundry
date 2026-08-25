import { friendlyAdminError } from '../admin-error';

const PHONE = '+639171234567';

describe('friendlyAdminError', () => {
  it('explains a permission failure without exposing the raw RPC wording', () => {
    const message = friendlyAdminError('not allowed', PHONE);

    expect(message).toMatch(/superadmin/i);
    expect(message).not.toBe('not allowed');
  });

  it('reports an already-registered mobile number in plain language', () => {
    const message = friendlyAdminError('User already registered', PHONE);

    expect(message).toMatch(/mobile number/i);
    expect(message).toMatch(/already/i);
  });

  it('reports a duplicate-key database error as an existing account', () => {
    const message = friendlyAdminError(
      'duplicate key value violates unique constraint "users_email_key"',
      PHONE
    );

    expect(message).toMatch(/already/i);
  });

  it('explains that provisioning is not deployed when the function is missing', () => {
    const message = friendlyAdminError('Function not found', PHONE);

    expect(message).toMatch(/not (been )?deployed|unavailable/i);
  });

  it('never leaks the synthetic auth email address', () => {
    const message = friendlyAdminError(
      'Email address 639171234567@example.com is invalid',
      PHONE
    );

    expect(message).not.toContain('@');
    expect(message).toContain(PHONE);
  });

  it('rewrites email wording into mobile-number wording', () => {
    const message = friendlyAdminError('Email rate limit exceeded', PHONE);

    expect(message).not.toMatch(/email/i);
    expect(message).toMatch(/mobile number/i);
  });

  it('passes an unrecognized message through unchanged', () => {
    expect(friendlyAdminError('Network request failed', PHONE)).toBe(
      'Network request failed'
    );
  });

  it('falls back to a generic message when there is no message at all', () => {
    expect(friendlyAdminError('', PHONE)).toMatch(/\w/);
  });
});
