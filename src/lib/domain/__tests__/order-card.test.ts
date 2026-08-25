import { formatOrderTime, shortOrderId } from '../order-card';

// Dates are built from local components (not ISO literals) so the expected
// rendering is timezone-independent.
const localIso = (
  y: number,
  monthIndex: number,
  d: number,
  h: number,
  min: number
) => new Date(y, monthIndex, d, h, min, 0).toISOString();

describe('shortOrderId', () => {
  it('shortens a uuid to a scannable reference', () => {
    expect(shortOrderId('4b141b63-9f2a-4c11-9d3e-77c1f0a2b8e4')).toBe('#4b141b63');
  });

  it('leaves an already-short id alone', () => {
    expect(shortOrderId('abc123')).toBe('#abc123');
  });
});

describe('formatOrderTime', () => {
  const now = new Date(2026, 7, 25, 19, 30);

  it('shows only the time for orders taken today', () => {
    expect(formatOrderTime(localIso(2026, 7, 25, 19, 9), now)).toBe('7:09 PM');
  });

  it('adds the date for orders from an earlier day', () => {
    expect(formatOrderTime(localIso(2026, 7, 24, 18, 36), now)).toBe('Aug 24, 6:36 PM');
  });

  it('adds the date for orders from another month', () => {
    expect(formatOrderTime(localIso(2026, 0, 3, 9, 5), now)).toBe('Jan 3, 9:05 AM');
  });

  it('renders midnight as 12 AM, not 0 AM', () => {
    expect(formatOrderTime(localIso(2026, 7, 25, 0, 5), now)).toBe('12:05 AM');
  });

  it('renders noon as 12 PM, not 0 PM', () => {
    expect(formatOrderTime(localIso(2026, 7, 25, 12, 0), now)).toBe('12:00 PM');
  });

  it('pads single-digit minutes', () => {
    expect(formatOrderTime(localIso(2026, 7, 25, 7, 5), now)).toBe('7:05 AM');
  });

  it('treats the same calendar day in a different year as not today', () => {
    expect(formatOrderTime(localIso(2025, 7, 25, 19, 9), now)).toBe('Aug 25, 7:09 PM');
  });
});
