import { MIN_PASSWORD_LENGTH } from '../credentials';
import { SHOP_ACCOUNT_ROLES, validateShopAccountForm } from '../shop-account';

const VALID = {
  fullName: 'Maria Santos',
  phoneInput: '0917 123 4567',
  password: 'temp1234',
  role: 'owner',
};

describe('SHOP_ACCOUNT_ROLES', () => {
  it('offers exactly owner and staff', () => {
    expect([...SHOP_ACCOUNT_ROLES]).toEqual(['owner', 'staff']);
  });
});

describe('validateShopAccountForm', () => {
  it('accepts a complete account and normalizes the phone to E.164', () => {
    const result = validateShopAccountForm(VALID);

    expect(result).toEqual({
      ok: true,
      account: {
        fullName: 'Maria Santos',
        phone: '+639171234567',
        password: 'temp1234',
        role: 'owner',
      },
    });
  });

  it('trims whitespace around the full name', () => {
    const result = validateShopAccountForm({ ...VALID, fullName: '  Maria Santos  ' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.account.fullName).toBe('Maria Santos');
  });

  it('rejects a blank full name with a fullName error', () => {
    const result = validateShopAccountForm({ ...VALID, fullName: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('fullName');
  });

  it('rejects an invalid mobile number with a phone error', () => {
    const result = validateShopAccountForm({ ...VALID, phoneInput: '12345' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('phone');
  });

  it('rejects a password shorter than the shared minimum', () => {
    const result = validateShopAccountForm({
      ...VALID,
      password: 'a'.repeat(MIN_PASSWORD_LENGTH - 1),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('password');
  });

  it('accepts a staff role', () => {
    const result = validateShopAccountForm({ ...VALID, role: 'staff' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.account.role).toBe('staff');
  });

  it('rejects an unknown role with a role error', () => {
    const result = validateShopAccountForm({ ...VALID, role: 'superadmin' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('role');
  });

  it('never echoes the password back in an error message', () => {
    const result = validateShopAccountForm({ ...VALID, password: 'short' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).not.toContain('short');
  });
});
