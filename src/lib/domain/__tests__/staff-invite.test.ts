import {
  STAFF_ONLY_ROLE,
  canAddStaff,
  describeStaffHandoff,
  validateStaffDraft,
} from '../staff-invite';

describe('canAddStaff', () => {
  it('lets an owner add staff to their own counter', () => {
    expect(canAddStaff('owner')).toBe(true);
  });

  it('does not let staff add more staff', () => {
    // Otherwise the first staff login is a key-cutting machine, and a shop
    // owner loses track of who can open their till.
    expect(canAddStaff('staff')).toBe(false);
  });
});

describe('STAFF_ONLY_ROLE', () => {
  it('is the one role an owner may ever mint', () => {
    // There is deliberately no role argument anywhere in this flow. An owner
    // who could pass a role could pass 'owner', and the database function
    // hardcodes the same word for the same reason.
    expect(STAFF_ONLY_ROLE).toBe('staff');
  });
});

describe('validateStaffDraft', () => {
  it('accepts a name and a mobile number, and hands back E.164', () => {
    const result = validateStaffDraft({ fullName: '  Ana Cruz ', phone: '0917 123 4567' });
    expect(result).toEqual({
      ok: true,
      value: { fullName: 'Ana Cruz', phone: '+639171234567' },
    });
  });

  it('asks for a name, because the orders list shows who took the order', () => {
    const result = validateStaffDraft({ fullName: '', phone: '09171234567' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.fullName).toBeTruthy();
  });

  it('rejects a single letter as a name', () => {
    const result = validateStaffDraft({ fullName: 'A', phone: '09171234567' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.fullName).toBeTruthy();
  });

  it('rejects a number that is not a mobile', () => {
    const result = validateStaffDraft({ fullName: 'Ana Cruz', phone: '12345' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.phone).toBeTruthy();
  });

  it('names both problems at once rather than one at a time', () => {
    const result = validateStaffDraft({ fullName: '', phone: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.fullName).toBeTruthy();
      expect(result.errors.phone).toBeTruthy();
    }
  });
});

describe('describeStaffHandoff', () => {
  it('is something an owner can read down a phone line', () => {
    const lines = describeStaffHandoff({
      fullName: 'Ana Cruz',
      phone: '+639171234567',
      password: 'Kf7mQr2xTuVw',
    });
    expect(lines).toContain('Ana Cruz');
    expect(lines).toContain('+639171234567');
    expect(lines).toContain('Kf7mQr2xTuVw');
  });

  it('says the password will not be shown again', () => {
    // It is never stored anywhere this app can read, so an owner who closes
    // the card without copying it has to reset it.
    const lines = describeStaffHandoff({
      fullName: 'Ana Cruz',
      phone: '+639171234567',
      password: 'Kf7mQr2xTuVw',
    });
    expect(lines.toLowerCase()).toContain('again');
  });
});
