import { railDays, railIndexOf } from '../day-rail';

/** A Friday, mid-morning, well inside a month. */
const NOW = new Date(2026, 8, 12, 9, 0, 0);
/** Two days before October, for the month turnover. */
const MONTH_END = new Date(2026, 8, 29, 9, 0, 0);

describe('railDays', () => {
  it('names today and tomorrow rather than dating them', () => {
    const [today, tomorrow] = railDays(0, 2, NOW);
    expect(today.lead).toBe('Today');
    expect(tomorrow.lead).toBe('Tomorrow');
  });

  it('gives every later day its weekday', () => {
    const [, , third] = railDays(0, 2, NOW);
    expect(third.dayOffset).toBe(2);
    expect(third.lead).toBe(
      new Date(2026, 8, 14).toLocaleDateString(undefined, { weekday: 'short' })
    );
  });

  it('runs from the nearest day to the furthest, one card each', () => {
    const days = railDays(0, 30, NOW);
    expect(days).toHaveLength(31);
    expect(days[0].dayOffset).toBe(0);
    expect(days[30].dayOffset).toBe(30);
  });

  it('lists only selectable days, so nothing on the rail is refused', () => {
    // The delivery leg starts at the pickup's own day, never at today.
    expect(railDays(3, 6, NOW).map((day) => day.dayOffset)).toEqual([3, 4, 5, 6]);
  });

  it('carries the date of each day', () => {
    expect(railDays(0, 1, NOW).map((day) => day.dayOfMonth)).toEqual([12, 13]);
  });

  it('names the month on the first card and again where it turns over', () => {
    const days = railDays(0, 3, MONTH_END);
    // 29 Sep, 30 Sep, 1 Oct, 2 Oct.
    expect(days.map((day) => day.dayOfMonth)).toEqual([29, 30, 1, 2]);
    expect(days[0].month).not.toBeNull();
    expect(days[1].month).toBeNull();
    expect(days[2].month).not.toBeNull();
    expect(days[3].month).toBeNull();
    expect(days[2].month).not.toBe(days[0].month);
  });

  it('marks today, and only today', () => {
    const days = railDays(0, 4, NOW);
    expect(days.filter((day) => day.isToday).map((day) => day.dayOffset)).toEqual([0]);
  });

  it('never offers a day already past', () => {
    expect(railDays(-5, 1, NOW).map((day) => day.dayOffset)).toEqual([0, 1]);
  });

  it('yields nothing for a window that has momentarily inverted', () => {
    expect(railDays(6, 3, NOW)).toEqual([]);
  });
});

describe('railIndexOf', () => {
  it('finds where the chosen day sits, so the rail can open on it', () => {
    const days = railDays(0, 10, NOW);
    expect(railIndexOf(days, 0)).toBe(0);
    expect(railIndexOf(days, 7)).toBe(7);
  });

  it('reports a chosen day the rail does not hold', () => {
    expect(railIndexOf(railDays(3, 6, NOW), 0)).toBe(-1);
  });
});
