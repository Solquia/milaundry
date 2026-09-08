/**
 * A month as a grid you can book from.
 *
 * The schedule step offered four day chips — today plus three — because four
 * fits a 2×2 grid. That is a layout constraint wearing a policy's clothes: a
 * customer who wants their laundry collected a week on Thursday had no way to
 * say so, and nothing on screen admitted the limit existed.
 *
 * A calendar says it. Days outside the window are drawn and greyed rather than
 * hidden, so the shape of what the shop accepts is visible instead of implied.
 *
 * A booking still stores `dayOffset` — days from today — which is what
 * `booking-slot` and the validator speak. Every cell carries its own offset, so
 * the calendar is a way of *choosing* an offset rather than a second model of
 * time that could drift from the first.
 *
 * `now` is passed in rather than read from the clock, so a grid can be tested
 * without the answer depending on the day CI happens to run.
 */

/** A month the calendar is looking at. `month` is 0-11, as `Date` counts. */
export interface MonthCursor {
  year: number;
  month: number;
}

/**
 * One square. A `pad` is the blank before the first of the month — drawn, not
 * skipped, or the columns stop being weekdays.
 */
export type CalendarCell =
  | { kind: 'pad' }
  | {
      kind: 'day';
      dayOfMonth: number;
      /** Days from today: what a booking stores. Negative is behind us. */
      dayOffset: number;
      isToday: boolean;
      isSelectable: boolean;
    };

/** Seven columns, Sunday first — the week as a Philippine calendar prints it. */
export const WEEKDAY_INITIALS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Midnight at the start of the day `date` falls in, in local time. */
function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Whole days between two moments.
 *
 * Rounded rather than truncated because a day is not always 24 hours: across a
 * daylight-saving boundary the gap is 23 or 25, and dividing that would put a
 * day either side of the seam off by one.
 */
function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

/** The offset of a given day of a given month, counted from today. */
export function dayOffsetOf(cursor: MonthCursor, dayOfMonth: number, now: Date): number {
  return daysBetween(now, new Date(cursor.year, cursor.month, dayOfMonth));
}

/** The month a chosen offset falls in, so the calendar opens where the answer is. */
export function monthOf(dayOffset: number, now: Date): MonthCursor {
  const date = new Date(startOfDay(now).getTime() + dayOffset * MS_PER_DAY);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/** A month `delta` steps away, rolling across the turn of the year. */
export function shiftMonth(cursor: MonthCursor, delta: number): MonthCursor {
  const date = new Date(cursor.year, cursor.month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

/**
 * What the header says.
 *
 * The year is added only once the calendar has walked out of the current one.
 * "January" alone, reached by paging forward from December, is a lie about
 * which January it means; "January 2026" printed above today's own month is
 * noise on every other screen.
 */
export function monthLabel(cursor: MonthCursor, now: Date): string {
  const date = new Date(cursor.year, cursor.month, 1);
  const month = date.toLocaleDateString(undefined, { month: 'long' });
  return cursor.year === now.getFullYear() ? month : `${month} ${cursor.year}`;
}

/** Days in a month. Day 0 of the next month is the last day of this one. */
function daysInMonth(cursor: MonthCursor): number {
  return new Date(cursor.year, cursor.month + 1, 0).getDate();
}

/**
 * The month as rows of seven.
 *
 * `minOffset` is the earliest day that may be chosen — 0 for pickup, the
 * pickup's own offset for delivery, which is how delivery can never be offered
 * before the collection it depends on. `maxOffset` is the far end of the
 * window the shop accepts.
 */
export function monthGrid(
  cursor: MonthCursor,
  now: Date,
  minOffset: number,
  maxOffset: number
): CalendarCell[][] {
  const total = daysInMonth(cursor);
  const leading = new Date(cursor.year, cursor.month, 1).getDay();
  const todayOffset = 0;

  const cells: CalendarCell[] = [];
  for (let pad = 0; pad < leading; pad += 1) cells.push({ kind: 'pad' });

  for (let dayOfMonth = 1; dayOfMonth <= total; dayOfMonth += 1) {
    const dayOffset = dayOffsetOf(cursor, dayOfMonth, now);
    cells.push({
      kind: 'day',
      dayOfMonth,
      dayOffset,
      isToday: dayOffset === todayOffset,
      isSelectable: dayOffset >= minOffset && dayOffset <= maxOffset,
    });
  }

  // Trailing pads so the last row is a full week and the grid keeps its shape
  // whether the month needs five rows or six.
  while (cells.length % 7 !== 0) cells.push({ kind: 'pad' });

  const weeks: CalendarCell[][] = [];
  for (let start = 0; start < cells.length; start += 7) {
    weeks.push(cells.slice(start, start + 7));
  }
  return weeks;
}

/**
 * Whether a month holds anything worth paging to.
 *
 * The arrow that leads to a month of dead days is hidden rather than disabled,
 * because an arrow that pages to nothing has lied about there being more.
 */
export function hasSelectableDay(
  cursor: MonthCursor,
  now: Date,
  minOffset: number,
  maxOffset: number
): boolean {
  const first = dayOffsetOf(cursor, 1, now);
  const last = dayOffsetOf(cursor, daysInMonth(cursor), now);
  return last >= minOffset && first <= maxOffset;
}
