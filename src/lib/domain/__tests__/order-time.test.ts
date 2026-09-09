import { formatWhen } from '../order-time';

/** A fixed "now" so every case reads against a known day. */
const NOW = new Date(2026, 7, 28, 9, 56); // Fri 28 Aug 2026, 9:56 AM

describe('formatWhen', () => {
  it('names today rather than making the customer read a date', () => {
    expect(formatWhen(new Date(2026, 7, 28, 9, 56).toISOString(), NOW)).toBe(
      'Today, 9:56 AM'
    );
  });

  it('names tomorrow', () => {
    expect(formatWhen(new Date(2026, 7, 29, 12, 0).toISOString(), NOW)).toBe(
      'Tomorrow, 12:00 PM'
    );
  });

  it('names yesterday', () => {
    expect(formatWhen(new Date(2026, 7, 27, 16, 20).toISOString(), NOW)).toBe(
      'Yesterday, 4:20 PM'
    );
  });

  // A pickup four days out is a weekday and a date. The year is noise: this
  // year is the only year a laundry order is ever in.
  it('gives a weekday and date inside the same year', () => {
    expect(formatWhen(new Date(2026, 8, 1, 12, 0).toISOString(), NOW)).toBe(
      'Tue 1 Sep, 12:00 PM'
    );
  });

  it('adds the year only when it is not this one', () => {
    expect(formatWhen(new Date(2027, 8, 1, 12, 0).toISOString(), NOW)).toBe(
      '1 Sep 2027, 12:00 PM'
    );
    expect(formatWhen(new Date(2025, 8, 1, 12, 0).toISOString(), NOW)).toBe(
      '1 Sep 2025, 12:00 PM'
    );
  });

  // Every one of these is a real clock face somebody has to read at a glance.
  it('reads the clock the way a person says it', () => {
    const at = (h: number, m: number) =>
      formatWhen(new Date(2026, 7, 28, h, m).toISOString(), NOW);

    expect(at(0, 0)).toBe('Today, 12:00 AM');
    expect(at(12, 0)).toBe('Today, 12:00 PM');
    expect(at(13, 5)).toBe('Today, 1:05 PM');
    expect(at(23, 59)).toBe('Today, 11:59 PM');
  });

  it('pads the minutes so times cannot be misread', () => {
    expect(formatWhen(new Date(2026, 7, 28, 9, 5).toISOString(), NOW)).toBe(
      'Today, 9:05 AM'
    );
  });

  /**
   * The defect this replaces: `new Date(x).toLocaleString()` prints the literal
   * string "Invalid Date" into the interface. An empty string lets the screen
   * drop the row instead of showing the customer a broken half-sentence.
   */
  it('says nothing at all rather than printing a broken date', () => {
    expect(formatWhen('not a date', NOW)).toBe('');
    expect(formatWhen('', NOW)).toBe('');
    expect(formatWhen(null, NOW)).toBe('');
    expect(formatWhen(undefined, NOW)).toBe('');
  });

  it('crosses a year boundary by the calendar, not by 24 hours', () => {
    const newYearEve = new Date(2026, 11, 31, 23, 0);

    expect(formatWhen(new Date(2027, 0, 1, 1, 0).toISOString(), newYearEve)).toBe(
      'Tomorrow, 1:00 AM'
    );
  });
});
