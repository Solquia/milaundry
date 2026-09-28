/**
 * The period the Sales screen looks through, and the one it is measured against.
 *
 * Periods are the ones a shop is run in — today, this week (Monday to
 * Sunday), this month, this year — not rolling windows, because rent, suppliers
 * and the BIR all count by the calendar. Any of them can be stepped back
 * ("‹ Fri 25 Sep") to browse history.
 *
 * The comparison is the fix for the old screen's daily jump scare: a period
 * still in progress is compared with the previous one *up to the same point*.
 * At 9 AM today is measured against yesterday by 9 AM, not all of yesterday,
 * so a normal morning no longer reads "−85%". A finished period is compared in
 * full with the one before it.
 */

export type PeriodKind = 'day' | 'week' | 'month' | 'year';

export interface SalesPeriod {
  kind: PeriodKind;
  /** 0 is the period the clock is in; −1 the one before, and so on. Never positive. */
  offset: number;
}

export type BucketUnit = 'hour' | 'day' | 'month';

export interface PeriodBucket {
  start: number;
  end: number;
  /** What the chart prints under this bar. */
  label: string;
  /** The bucket the clock is in right now. */
  isCurrent: boolean;
  /** Still to come: drawn as a ghost only. */
  isFuture: boolean;
  /** The matching slice of the comparison period; empty when it has no twin (31 March vs February). */
  compareStart: number;
  compareEnd: number;
}

export interface PeriodFrame {
  period: SalesPeriod;
  start: number;
  end: number;
  /** Where counting stops: now for a live period, the end for a finished one. */
  cutoff: number;
  isLive: boolean;
  compareStart: number;
  /** The same point in the comparison period, so a live period is compared fairly. */
  compareCutoff: number;
  unit: BucketUnit;
  buckets: PeriodBucket[];
  /** "Today", "This week", or the dates of a stepped-back period. */
  title: string;
  /** The dates, always: "Mon 28 Sep", "28 Sep – 4 Oct", "September 2026". */
  caption: string;
  /** Finishes "vs …": "yesterday by 2:15 PM", "last month at this point", "July". */
  compareLabel: string;
}

export const PERIOD_PRESETS: readonly { label: string; period: SalesPeriod }[] = [
  { label: 'Today', period: { kind: 'day', offset: 0 } },
  { label: 'Yesterday', period: { kind: 'day', offset: -1 } },
  { label: 'This week', period: { kind: 'week', offset: 0 } },
  { label: 'This month', period: { kind: 'month', offset: 0 } },
  { label: 'Last month', period: { kind: 'month', offset: -1 } },
  { label: 'This year', period: { kind: 'year', offset: 0 } },
];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function isSamePeriod(a: SalesPeriod, b: SalesPeriod): boolean {
  return a.kind === b.kind && a.offset === b.offset;
}

/** One period earlier or later; null when that would be the future. */
export function stepPeriod(period: SalesPeriod, direction: -1 | 1): SalesPeriod | null {
  const offset = period.offset + direction;
  return offset > 0 ? null : { kind: period.kind, offset };
}

function bounds(kind: PeriodKind, offset: number, now: Date): { start: Date; end: Date } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  switch (kind) {
    case 'day':
      return { start: new Date(y, m, d + offset), end: new Date(y, m, d + offset + 1) };
    case 'week': {
      const monday = d - ((now.getDay() + 6) % 7) + offset * 7;
      return { start: new Date(y, m, monday), end: new Date(y, m, monday + 7) };
    }
    case 'month':
      return { start: new Date(y, m + offset, 1), end: new Date(y, m + offset + 1, 1) };
    case 'year':
      return { start: new Date(y + offset, 0, 1), end: new Date(y + offset + 1, 0, 1) };
  }
}

/**
 * The same calendar moment one period back: yesterday's 2:15, last month's
 * 28th. Null when the last period has no such moment (the 31st against February).
 */
function shiftBack(time: Date, kind: PeriodKind): Date | null {
  const y = time.getFullYear();
  const m = time.getMonth();
  const d = time.getDate();
  const h = time.getHours();
  const min = time.getMinutes();
  switch (kind) {
    case 'day':
      return new Date(y, m, d - 1, h, min);
    case 'week':
      return new Date(y, m, d - 7, h, min);
    case 'month': {
      const back = new Date(y, m - 1, d, h, min);
      return back.getMonth() === (m + 11) % 12 ? back : null;
    }
    case 'year': {
      const back = new Date(y - 1, m, d, h, min);
      return back.getMonth() === m ? back : null;
    }
  }
}

function hourLabel(hour: number): string {
  if (hour === 0) return '12a';
  if (hour < 12) return `${hour}a`;
  if (hour === 12) return '12p';
  return `${hour - 12}p`;
}

export function clockTime(time: Date): string {
  const hour = time.getHours();
  const minutes = String(time.getMinutes()).padStart(2, '0');
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minutes} ${hour < 12 ? 'AM' : 'PM'}`;
}

const dayMonth = (date: Date): string => `${date.getDate()} ${MONTHS[date.getMonth()]}`;

interface Slice {
  start: Date;
  end: Date;
  label: string;
}

function slices(kind: PeriodKind, start: Date): Slice[] {
  const y = start.getFullYear();
  const m = start.getMonth();
  const d = start.getDate();
  switch (kind) {
    case 'day':
      return Array.from({ length: 24 }, (_, h) => ({
        start: new Date(y, m, d, h),
        end: new Date(y, m, d, h + 1),
        label: hourLabel(h),
      }));
    case 'week':
      return Array.from({ length: 7 }, (_, i) => ({
        start: new Date(y, m, d + i),
        end: new Date(y, m, d + i + 1),
        label: WEEKDAYS[new Date(y, m, d + i).getDay()],
      }));
    case 'month': {
      const days = new Date(y, m + 1, 0).getDate();
      return Array.from({ length: days }, (_, i) => ({
        start: new Date(y, m, i + 1),
        end: new Date(y, m, i + 2),
        label: String(i + 1),
      }));
    }
    case 'year':
      return Array.from({ length: 12 }, (_, i) => ({
        start: new Date(y, i, 1),
        end: new Date(y, i + 1, 1),
        label: MONTHS[i],
      }));
  }
}

const UNITS: Record<PeriodKind, BucketUnit> = { day: 'hour', week: 'day', month: 'day', year: 'month' };

function captionFor(kind: PeriodKind, start: Date, end: Date): string {
  switch (kind) {
    case 'day':
      return `${WEEKDAYS[start.getDay()]} ${dayMonth(start)}`;
    case 'week':
      return `${dayMonth(start)} – ${dayMonth(new Date(end.getTime() - 1))}`;
    case 'month':
      return `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
    case 'year':
      return String(start.getFullYear());
  }
}

function compareLabelFor(kind: PeriodKind, isLive: boolean, now: Date, compareStart: Date): string {
  if (isLive) return kind === 'day' ? `yesterday by ${clockTime(now)}` : `last ${kind} at this point`;
  switch (kind) {
    case 'day':
      return 'the day before';
    case 'week':
      return 'the week before';
    case 'month':
      return MONTH_NAMES[compareStart.getMonth()];
    case 'year':
      return String(compareStart.getFullYear());
  }
}

/** Where a slice's twin sits in the comparison period, clamped so it never leaks past it. */
function twinOf(slice: Slice, kind: PeriodKind, compareEnd: number): { start: number; end: number } {
  const twinStart = shiftBack(slice.start, kind);
  if (!twinStart) return { start: compareEnd, end: compareEnd };
  const twinEnd = shiftBack(slice.end, kind)?.getTime() ?? compareEnd;
  return { start: twinStart.getTime(), end: Math.min(twinEnd, compareEnd) };
}

export function frameFor(period: SalesPeriod, now: Date): PeriodFrame {
  const { kind, offset } = period;
  const { start, end } = bounds(kind, offset, now);
  const previous = bounds(kind, offset - 1, now);
  const isLive = offset === 0;
  const nowMs = now.getTime();
  const previousEnd = previous.end.getTime();

  const compareCutoff = isLive
    ? Math.min(shiftBack(now, kind)?.getTime() ?? previousEnd, previousEnd)
    : previousEnd;

  const buckets = slices(kind, start).map((slice) => {
    const twin = twinOf(slice, kind, previousEnd);
    return {
      start: slice.start.getTime(),
      end: slice.end.getTime(),
      label: slice.label,
      isCurrent: isLive && slice.start.getTime() <= nowMs && nowMs < slice.end.getTime(),
      isFuture: slice.start.getTime() > nowMs,
      compareStart: twin.start,
      compareEnd: twin.end,
    };
  });

  const preset = PERIOD_PRESETS.find((option) => isSamePeriod(option.period, period));
  const caption = captionFor(kind, start, end);

  return {
    period,
    start: start.getTime(),
    end: end.getTime(),
    cutoff: isLive ? nowMs : end.getTime(),
    isLive,
    compareStart: previous.start.getTime(),
    compareCutoff,
    unit: UNITS[kind],
    buckets,
    title: preset?.label ?? caption,
    caption,
    compareLabel: compareLabelFor(kind, isLive, now, previous.start),
  };
}