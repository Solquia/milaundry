import {
  PERIOD_PRESETS,
  frameFor,
  isSamePeriod,
  stepPeriod,
  type SalesPeriod,
} from '../sales-period';

// Monday 28 Sep 2026, 2:15 PM local.
const NOW = new Date(2026, 8, 28, 14, 15);
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m, d, h, min).getTime();

describe('periods a shopkeeper counts in', () => {
  it('offers today, yesterday, this week, this month, last month and this year', () => {
    expect(PERIOD_PRESETS.map((preset) => preset.label)).toEqual([
      'Today',
      'Yesterday',
      'This week',
      'This month',
      'Last month',
      'This year',
    ]);
  });

  it('counts today from midnight up to now, against yesterday up to the same time', () => {
    const frame = frameFor({ kind: 'day', offset: 0 }, NOW);
    expect(frame.start).toBe(at(2026, 8, 28));
    expect(frame.end).toBe(at(2026, 8, 29));
    expect(frame.cutoff).toBe(NOW.getTime());
    expect(frame.isLive).toBe(true);
    expect(frame.compareStart).toBe(at(2026, 8, 27));
    expect(frame.compareCutoff).toBe(at(2026, 8, 27, 14, 15));
    expect(frame.compareLabel).toBe('yesterday by 2:15 PM');
    expect(frame.caption).toBe('Mon 28 Sep');
  });

  it('compares a finished day in full against the day before it', () => {
    const frame = frameFor({ kind: 'day', offset: -1 }, NOW);
    expect(frame.start).toBe(at(2026, 8, 27));
    expect(frame.cutoff).toBe(at(2026, 8, 28));
    expect(frame.isLive).toBe(false);
    expect(frame.compareStart).toBe(at(2026, 8, 26));
    expect(frame.compareCutoff).toBe(at(2026, 8, 27));
    expect(frame.title).toBe('Yesterday');
    expect(frame.compareLabel).toBe('the day before');
  });

  it('breaks a day into hours, and marks the hour the clock is in', () => {
    const frame = frameFor({ kind: 'day', offset: 0 }, NOW);
    expect(frame.unit).toBe('hour');
    expect(frame.buckets).toHaveLength(24);
    expect(frame.buckets[14].isCurrent).toBe(true);
    expect(frame.buckets[15].isFuture).toBe(true);
    expect(frame.buckets[9].label).toBe('9a');
    expect(frame.buckets[12].label).toBe('12p');
    expect(frame.buckets[14].compareStart).toBe(at(2026, 8, 27, 14));
  });

  it('starts the week on Monday and lays out seven days', () => {
    const frame = frameFor({ kind: 'week', offset: 0 }, new Date(2026, 8, 30, 9));
    expect(frame.start).toBe(at(2026, 8, 28));
    expect(frame.end).toBe(at(2026, 9, 5));
    expect(frame.buckets.map((bucket) => bucket.label)).toEqual([
      'Mon',
      'Tue',
      'Wed',
      'Thu',
      'Fri',
      'Sat',
      'Sun',
    ]);
    expect(frame.compareStart).toBe(at(2026, 8, 21));
    expect(frame.compareCutoff).toBe(at(2026, 8, 23, 9));
    expect(frame.caption).toBe('28 Sep – 4 Oct');
  });

  it('treats Sunday as the last day of its week', () => {
    const frame = frameFor({ kind: 'week', offset: 0 }, new Date(2026, 9, 4, 20));
    expect(frame.start).toBe(at(2026, 8, 28));
  });

  it('runs this month from the 1st, against last month at the same point', () => {
    const frame = frameFor({ kind: 'month', offset: 0 }, NOW);
    expect(frame.start).toBe(at(2026, 8, 1));
    expect(frame.end).toBe(at(2026, 9, 1));
    expect(frame.buckets).toHaveLength(30);
    expect(frame.compareStart).toBe(at(2026, 7, 1));
    expect(frame.compareCutoff).toBe(at(2026, 7, 28, 14, 15));
    expect(frame.caption).toBe('September 2026');
  });

  it('never lets last month at the same point run past the end of that month', () => {
    const frame = frameFor({ kind: 'month', offset: 0 }, new Date(2026, 2, 31, 12));
    // 31 March against February, which ends on the 28th.
    expect(frame.compareCutoff).toBe(at(2026, 2, 1));
  });

  it('gives a month day with no twin last month an empty comparison', () => {
    const frame = frameFor({ kind: 'month', offset: 0 }, new Date(2026, 2, 31, 12));
    const day31 = frame.buckets[30];
    expect(day31.compareEnd).toBe(day31.compareStart);
  });

  it('compares a finished month in full', () => {
    const frame = frameFor({ kind: 'month', offset: -1 }, NOW);
    expect(frame.start).toBe(at(2026, 7, 1));
    expect(frame.cutoff).toBe(at(2026, 8, 1));
    expect(frame.compareLabel).toBe('July');
    expect(frame.title).toBe('Last month');
  });

  it('rolls the year into twelve months', () => {
    const frame = frameFor({ kind: 'year', offset: 0 }, NOW);
    expect(frame.unit).toBe('month');
    expect(frame.buckets).toHaveLength(12);
    expect(frame.buckets[8].isCurrent).toBe(true);
    expect(frame.caption).toBe('2026');
    expect(frame.compareLabel).toBe('last year at this point');
  });
});

describe('stepping through periods', () => {
  it('steps back and forward, but never into the future', () => {
    const today: SalesPeriod = { kind: 'day', offset: 0 };
    expect(stepPeriod(today, -1)).toEqual({ kind: 'day', offset: -1 });
    expect(stepPeriod(today, 1)).toBeNull();
    expect(stepPeriod({ kind: 'month', offset: -2 }, 1)).toEqual({ kind: 'month', offset: -1 });
  });

  it('names an older stepped period by its dates', () => {
    expect(frameFor({ kind: 'day', offset: -3 }, NOW).title).toBe('Fri 25 Sep');
    expect(frameFor({ kind: 'month', offset: -3 }, NOW).title).toBe('June 2026');
  });

  it('knows when two periods are the same', () => {
    expect(isSamePeriod({ kind: 'day', offset: 0 }, { kind: 'day', offset: 0 })).toBe(true);
    expect(isSamePeriod({ kind: 'day', offset: 0 }, { kind: 'week', offset: 0 })).toBe(false);
  });
});
