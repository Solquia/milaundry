import { chopDate, memberSince, profileFacts, profileInitials } from '../ticket-stamp';

describe('chopDate', () => {
  // Local-time strings throughout: a chop prints the day it was inked at the
  // counter, so the test must not depend on the machine's offset from UTC.
  test('reads a stamp the way a date chop prints one: month over day, year beneath', () => {
    expect(chopDate('2026-09-15T11:12:00')).toEqual({
      month: 'SEP',
      day: '15',
      year: '2026',
    });
  });

  test('pads a single-digit day, because a chop sets both wheels', () => {
    expect(chopDate('2026-01-04T09:00:00')).toEqual({
      month: 'JAN',
      day: '04',
      year: '2026',
    });
  });

  test('stamps nothing readable rather than "NaN" when the date is unusable', () => {
    expect(chopDate('not a date')).toBeNull();
    expect(chopDate('')).toBeNull();
  });
});

describe('profileInitials', () => {
  test('takes the first letter of the first and last names', () => {
    expect(profileInitials('Maria Santos')).toBe('MS');
  });

  test('one name gives one letter', () => {
    expect(profileInitials('Maria')).toBe('M');
  });

  test('skips the middle names rather than running to four letters', () => {
    expect(profileInitials('Ana Maria Reyes Cruz')).toBe('AC');
  });

  test('falls back to a person glyph stand-in when there is no name', () => {
    expect(profileInitials('')).toBe('?');
    expect(profileInitials(null)).toBe('?');
  });
});

describe('memberSince', () => {
  test('names the month and year the account was made', () => {
    expect(memberSince('2026-09-15T11:12:00')).toBe('September 2026');
  });

  test('says nothing rather than guessing when the date is unusable', () => {
    expect(memberSince(undefined)).toBe('');
  });
});

describe('profileFacts', () => {
  test('counts the shops and the loads, and says when they joined', () => {
    expect(
      profileFacts({ shopCount: 1, orderCount: 3, createdAt: '2026-09-15T11:12:00' })
    ).toBe('1 shop · 3 loads · since September 2026');
  });

  test('pluralises both counts on their own', () => {
    expect(
      profileFacts({ shopCount: 2, orderCount: 1, createdAt: '2026-09-15T11:12:00' })
    ).toBe('2 shops · 1 load · since September 2026');
  });

  test('drops the join date rather than printing an empty tail', () => {
    expect(profileFacts({ shopCount: 0, orderCount: 0, createdAt: null })).toBe(
      'No shops yet · no loads yet'
    );
  });

  test('says "no loads yet" rather than "0 loads": nobody counts their zero', () => {
    expect(
      profileFacts({ shopCount: 1, orderCount: 0, createdAt: '2026-09-15T11:12:00' })
    ).toBe('1 shop · no loads yet · since September 2026');
  });
});
