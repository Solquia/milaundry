import {
  RANGES,
  RANGE_LABELS,
  isWithin,
  previousWindow,
  rangeCaption,
  rangeWindow,
  trendBuckets,
} from '../analytics-range';

// A Sunday afternoon, so a 7-day window has to reach back into last week.
const NOW = new Date('2026-09-06T14:30:00');

describe('analytics range windows', () => {
  it('names every range in the order the picker shows them', () => {
    expect(RANGES).toEqual(['today', '7d', '30d', '90d', 'all']);
    expect(RANGE_LABELS.today).toBe('Today');
    expect(RANGE_LABELS.all).toBe('All time');
  });

  it("today's window runs from local midnight to the next midnight", () => {
    const window = rangeWindow('today', NOW);
    expect(new Date(window.start!).toISOString()).toBe(
      new Date('2026-09-06T00:00:00').toISOString()
    );
    expect(new Date(window.end).toISOString()).toBe(
      new Date('2026-09-07T00:00:00').toISOString()
    );
  });

  it('a 7-day window includes today and the six days before it', () => {
    const window = rangeWindow('7d', NOW);
    expect(new Date(window.start!).getDate()).toBe(31);
    expect(new Date(window.start!).getMonth()).toBe(7); // August
    expect(new Date(window.end).getDate()).toBe(7);
  });

  it('all time has no start', () => {
    expect(rangeWindow('all', NOW).start).toBeNull();
  });

  it('the previous window is the same length, ending where this one starts', () => {
    const window = rangeWindow('30d', NOW);
    const previous = previousWindow(window)!;
    expect(previous.end).toBe(window.start);
    expect(previous.end - previous.start!).toBe(window.end - window.start!);
  });

  it('all time has no previous window to compare against', () => {
    expect(previousWindow(rangeWindow('all', NOW))).toBeNull();
  });

  it('membership is start-inclusive and end-exclusive', () => {
    const window = rangeWindow('today', NOW);
    expect(isWithin('2026-09-06T00:00:00', window)).toBe(true);
    expect(isWithin('2026-09-06T23:59:59', window)).toBe(true);
    expect(isWithin('2026-09-07T00:00:00', window)).toBe(false);
    expect(isWithin('2026-09-05T23:59:59', window)).toBe(false);
  });

  it('a missing or broken timestamp is never within a window', () => {
    const window = rangeWindow('all', NOW);
    expect(isWithin(null, window)).toBe(false);
    expect(isWithin('not a date', window)).toBe(false);
  });

  it('captions the window in words the owner would use', () => {
    expect(rangeCaption('today', NOW)).toBe('Sun 6 Sep');
    expect(rangeCaption('7d', NOW)).toBe('31 Aug – 6 Sep');
    expect(rangeCaption('all', NOW)).toBe('Since you opened');
  });
});

describe('trend buckets', () => {
  it('today still shows a week of daily bars so one bar has company', () => {
    const buckets = trendBuckets('today', NOW);
    expect(buckets).toHaveLength(7);
    expect(buckets[6].label).toBe('Sun');
    expect(buckets[6].isCurrent).toBe(true);
  });

  it('thirty days gives thirty daily bars labelled by day of month', () => {
    const buckets = trendBuckets('30d', NOW);
    expect(buckets).toHaveLength(30);
    expect(buckets[29].label).toBe('6');
    expect(buckets[0].label).toBe('8');
  });

  it('ninety days rolls up into thirteen weeks', () => {
    const buckets = trendBuckets('90d', NOW);
    expect(buckets).toHaveLength(13);
    // Each bucket is exactly seven days wide.
    expect(buckets[1].start - buckets[0].start).toBe(7 * 86_400_000);
    expect(buckets[12].end).toBeGreaterThan(NOW.getTime());
  });

  it('all time gives the last twelve months', () => {
    const buckets = trendBuckets('all', NOW);
    expect(buckets).toHaveLength(12);
    expect(buckets[0].label).toBe('Oct');
    expect(buckets[11].label).toBe('Sep');
  });

  it('buckets tile the axis with no gaps', () => {
    for (const range of RANGES) {
      const buckets = trendBuckets(range, NOW);
      for (let i = 1; i < buckets.length; i += 1) {
        expect(buckets[i].start).toBe(buckets[i - 1].end);
      }
    }
  });
});
