import { MAX_SHOP_NAME_LENGTH, validateShopForm } from '../shop-form';

describe('validateShopForm', () => {
  it('accepts a complete shop and normalizes the phone to E.164', () => {
    const result = validateShopForm({
      name: 'Sparkle Wash',
      address: '123 Rizal Ave',
      phoneInput: '0917 123 4567',
    });

    expect(result).toEqual({
      ok: true,
      values: {
        name: 'Sparkle Wash',
        address: '123 Rizal Ave',
        phone: '+639171234567',
      },
    });
  });

  it('trims surrounding whitespace from name and address', () => {
    const result = validateShopForm({
      name: '  Sparkle Wash  ',
      address: '  123 Rizal Ave  ',
      phoneInput: '',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.values.name).toBe('Sparkle Wash');
      expect(result.values.address).toBe('123 Rizal Ave');
    }
  });

  it('rejects a blank name with a name error', () => {
    const result = validateShopForm({ name: '   ', address: '', phoneInput: '' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('name');
  });

  it('rejects a name longer than the maximum', () => {
    const result = validateShopForm({
      name: 'a'.repeat(MAX_SHOP_NAME_LENGTH + 1),
      address: '',
      phoneInput: '',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('name');
  });

  it('accepts a name exactly at the maximum length', () => {
    const result = validateShopForm({
      name: 'a'.repeat(MAX_SHOP_NAME_LENGTH),
      address: '',
      phoneInput: '',
    });

    expect(result.ok).toBe(true);
  });

  it('treats an omitted phone as an empty string rather than an error', () => {
    const result = validateShopForm({ name: 'Sparkle Wash', address: '', phoneInput: '  ' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.values.phone).toBe('');
  });

  it('rejects a malformed phone with a phone error', () => {
    const result = validateShopForm({
      name: 'Sparkle Wash',
      address: '',
      phoneInput: '12345',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('phone');
  });

  it('allows an address to be omitted', () => {
    const result = validateShopForm({ name: 'Sparkle Wash', address: '', phoneInput: '' });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.values.address).toBe('');
  });
});
