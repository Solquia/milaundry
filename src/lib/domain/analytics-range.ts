/**
 * The window the earnings screen looks through.
 *
 * "Today" was the only view the old screen had, so an owner who wanted to
 * know whether this week was better than last had to remember last week.
 * Every range here is a calendar fact — whole local days, ending at the next
 * midnight — so "7 days" means today and the six days before it, the way a
 * shopkeeper counts a week, and never "the last 168 hours".
 */

export const RANGES = ['today', '7d', '30d', '90d', 'all'] as const;
export type RangeKey = (typeof RANGES)[number];

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
  all: 'All time',
};

/** Whole days each range covers; null is open-ended. */
const RANGE_DAYS: Record<RangeKey, number | null> = {
  today: 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
};

/** Epoch milliseconds. `start` null means "since the shop opened". */
export interface DateWindow {
  start: number | null;
  end: number;
}

export interface TrendBucket {
  start: number;
  end: number;
  /** What the axis prints under this bar. */
  label: string;
  /** The bucket the clock is in right now. */
  isCurrent: boolean;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Local midnight `offsetDays` from the given date, by calendar arithmetic. */
function dayStart(date: Date, offsetDays = 0): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + offsetDays).getTime();
}

export function rangeWindow(range: RangeKey, now: Date): DateWindow {
  const end = dayStart(now, 1);
  const days = RANGE_DAYS[range];
  if (days === null) return { start: null, end };
  return { start: dayStart(now, 1 - days), end };
}

/** The window of the same length immediately before this one. */
export function previousWindow(window: DateWindow): DateWindow | null {
  if (window.start === null) return null;
  const length = window.end - window.start;
  return { start: window.start - length, end: window.start };
}

export function isWithin(iso: string | null | undefined, window: DateWindow): boolean {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return false;
  if (window.start !== null && time < window.start) return false;
  return time < window.end;
}

function dayMonth(time: number): string {
  const date = new Date(time);
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** `Sun 6 Sep`, `31 Aug – 6 Sep`, or `Since you opened`. */
export function rangeCaption(range: RangeKey, now: Date): string {
  if (range === 'all') return 'Since you opened';
  if (range === 'today') return `${WEEKDAYS[now.getDay()]} ${dayMonth(now.getTime())}`;
  const window = rangeWindow(range, now);
  return `${dayMonth(window.start!)} – ${dayMonth(now.getTime())}`;
}

/**
 * The bars under the headline figure.
 *
 * A single bar for "today" says nothing, so today borrows the week around it.
 * Ninety daily bars would be a barcode, so they roll up into weeks; all time
 * rolls up into the last twelve months. Every set tiles its axis with no gaps.
 */
export function trendBuckets(range: RangeKey, now: Date): TrendBucket[] {
  switch (range) {
    case 'today':
    case '7d':
      return dailyBuckets(now, 7, (time) => WEEKDAYS[new Date(time).getDay()]);
    case '30d':
      return dailyBuckets(now, 30, (time) => String(new Date(time).getDate()));
    case '90d':
      return weeklyBuckets(now, 13);
    case 'all':
      return monthlyBuckets(now, 12);
  }
}

function dailyBuckets(now: Date, count: number, label: (time: number) => string): TrendBucket[] {
  return Array.from({ length: count }, (_, index) => {
    const start = dayStart(now, index + 1 - count);
    const end = dayStart(now, index + 2 - count);
    return { start, end, label: label(start), isCurrent: index === count - 1 };
  });
}

function weeklyBuckets(now: Date, count: number): TrendBucket[] {
  return Array.from({ length: count }, (_, index) => {
    const weeksBack = count - index;
    const start = dayStart(now, 1 - weeksBack * 7);
    const end = dayStart(now, 1 - (weeksBack - 1) * 7);
    return { start, end, label: dayMonth(start), isCurrent: index === count - 1 };
  });
}

function monthlyBuckets(now: Date, count: number): TrendBucket[] {
  return Array.from({ length: count }, (_, index) => {
    const monthOffset = index + 1 - count;
    const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1).getTime();
    return {
      start,
      end,
      label: MONTHS[new Date(start).getMonth()],
      isCurrent: index === count - 1,
    };
  });
}
