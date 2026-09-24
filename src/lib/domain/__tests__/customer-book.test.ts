import {
  addressPickerLabel,
  defaultAddress,
  formatAddressLine,
  matchSavedAddress,
  needsHandle,
  paymentPreferenceSummary,
  sortAddresses,
  validateAddress,
  validatePaymentPreference,
  type SavedAddress,
} from '../customer-book';

const address = (over: Partial<SavedAddress> = {}): SavedAddress => ({
  id: 'a1',
  profile_id: 'p1',
  label: 'Home',
  address: '12 Mabini St, Quezon City',
  notes: '',
  is_default: false,
  created_at: '2026-09-01T10:00:00.000Z',
  ...over,
});

describe('sortAddresses', () => {
  test('puts the default first, whatever order the rows arrived in', () => {
    const office = address({ id: 'a2', label: 'Office', created_at: '2026-09-09T10:00:00.000Z' });
    const home = address({ id: 'a1', is_default: true });
    expect(sortAddresses([office, home]).map((row) => row.id)).toEqual(['a1', 'a2']);
  });

  test('orders the rest newest first: the one just added is the one being used', () => {
    const older = address({ id: 'a1', created_at: '2026-09-01T10:00:00.000Z' });
    const newer = address({ id: 'a2', created_at: '2026-09-09T10:00:00.000Z' });
    expect(sortAddresses([older, newer]).map((row) => row.id)).toEqual(['a2', 'a1']);
  });

  test('does not mutate the list it was handed', () => {
    const list = [address({ id: 'a1' }), address({ id: 'a2', is_default: true })];
    sortAddresses(list);
    expect(list.map((row) => row.id)).toEqual(['a1', 'a2']);
  });
});

describe('defaultAddress', () => {
  test('is the one marked default', () => {
    const picked = defaultAddress([address({ id: 'a1' }), address({ id: 'a2', is_default: true })]);
    expect(picked?.id).toBe('a2');
  });

  test('falls back to the newest when nothing is marked, rather than to nothing', () => {
    const picked = defaultAddress([
      address({ id: 'a1', created_at: '2026-09-01T10:00:00.000Z' }),
      address({ id: 'a2', created_at: '2026-09-09T10:00:00.000Z' }),
    ]);
    expect(picked?.id).toBe('a2');
  });

  test('is null for a customer who has saved none', () => {
    expect(defaultAddress([])).toBeNull();
  });
});

describe('validateAddress', () => {
  test('trims both fields and keeps what was typed', () => {
    const result = validateAddress({ label: '  Home ', address: ' 12 Mabini St ', notes: ' gate ' });
    expect(result).toEqual({
      ok: true,
      value: {
        label: 'Home',
        address: '12 Mabini St',
        notes: 'gate',
        building: '',
        unit: '',
        landmark: '',
      },
    });
  });

  test('asks for a name, because a list of unnamed addresses is unusable', () => {
    const result = validateAddress({ label: '   ', address: '12 Mabini St', notes: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.label).toMatch(/name/i);
  });

  test('asks for an address a rider could actually find', () => {
    const result = validateAddress({ label: 'Home', address: '  ', notes: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.address).toMatch(/address/i);
  });

  test('refuses more than the column holds instead of letting the write fail', () => {
    const result = validateAddress({ label: 'H'.repeat(41), address: 'x', notes: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.label).toMatch(/shorter/i);
  });
});

describe('needsHandle', () => {
  test('a wallet needs the number the shop sends the request to', () => {
    expect(needsHandle('gcash')).toBe(true);
    expect(needsHandle('maya')).toBe(true);
  });

  test('cash and a bank transfer do not', () => {
    expect(needsHandle('cash')).toBe(false);
    expect(needsHandle('bank_transfer')).toBe(false);
  });
});

describe('validatePaymentPreference', () => {
  test('keeps the wallet number that belongs to the method', () => {
    expect(validatePaymentPreference({ method: 'gcash', handle: ' 0917 555 0123 ' })).toEqual({
      ok: true,
      value: { method: 'gcash', handle: '0917 555 0123' },
    });
  });

  test('asks for the wallet number when the method needs one', () => {
    const result = validatePaymentPreference({ method: 'maya', handle: '  ' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.handle).toMatch(/number/i);
  });

  test('drops a handle that belongs to a method no longer chosen', () => {
    expect(validatePaymentPreference({ method: 'cash', handle: '0917 555 0123' })).toEqual({
      ok: true,
      value: { method: 'cash', handle: '' },
    });
  });
});

describe('paymentPreferenceSummary', () => {
  test('names the wallet and the number it would be sent to', () => {
    expect(paymentPreferenceSummary({ method: 'gcash', handle: '0917 555 0123' })).toBe(
      'GCash · 0917 555 0123'
    );
  });

  test('names a method that carries no number on its own', () => {
    expect(paymentPreferenceSummary({ method: 'cash', handle: '' })).toBe('Cash');
  });

  test('says nothing has been chosen rather than defaulting to cash silently', () => {
    expect(paymentPreferenceSummary({ method: null, handle: '' })).toBe('Not set yet');
  });
});

describe('addressPickerLabel', () => {
  test('is the label and the street, so two "Home"s are still distinguishable', () => {
    expect(addressPickerLabel(address())).toBe('Home · 12 Mabini St, Quezon City');
  });
});

describe('building, unit and landmark', () => {
  test('are trimmed and kept', () => {
    const result = validateAddress({
      label: 'Home',
      address: '12 Mabini St',
      notes: '',
      building: ' Tower 2 ',
      unit: ' 4B ',
      landmark: ' near 7-Eleven ',
    });
    expect(result.ok && result.value).toMatchObject({
      building: 'Tower 2',
      unit: '4B',
      landmark: 'near 7-Eleven',
    });
  });

  test('are refused past what their columns hold', () => {
    const result = validateAddress({
      label: 'Home',
      address: '12 Mabini St',
      notes: '',
      building: 'b'.repeat(81),
      unit: 'u'.repeat(41),
      landmark: 'l'.repeat(121),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.building).toMatch(/shorter/i);
      expect(result.errors.unit).toMatch(/shorter/i);
      expect(result.errors.landmark).toMatch(/shorter/i);
    }
  });
});

describe('formatAddressLine', () => {
  test('puts unit and building ahead of the street, landmark after', () => {
    expect(
      formatAddressLine({
        address: '12 Mabini St, Quezon City',
        building: 'Tower 2',
        unit: '4B',
        landmark: '7-Eleven',
      })
    ).toBe('Unit 4B, Tower 2, 12 Mabini St, Quezon City (near 7-Eleven)');
  });

  test('does not say "near" twice or "Unit" twice', () => {
    expect(
      formatAddressLine({ address: '12 Mabini St', building: '', unit: 'Unit 3', landmark: 'Near the church' })
    ).toBe('Unit 3, 12 Mabini St (near the church)');
  });

  test('is just the street for an address saved before the extra fields', () => {
    expect(formatAddressLine(address())).toBe('12 Mabini St, Quezon City');
  });
});

describe('matchSavedAddress', () => {
  const tower = address({ id: 'a2', unit: '4B', building: 'Tower 2' });

  test('finds the saved address a booking line was made from', () => {
    expect(matchSavedAddress([address(), tower], 'Unit 4B, Tower 2, 12 Mabini St, Quezon City')?.id).toBe('a2');
  });

  test('ignores case and stray spaces', () => {
    expect(matchSavedAddress([address()], '  12 mabini st, quezon city ')?.id).toBe('a1');
  });

  test('is null for somewhere new', () => {
    expect(matchSavedAddress([address()], '9 Rizal Ave')).toBeNull();
  });
});