/**
 * The bookable days, in the order a customer thinks of them.
 *
 * The schedule step used to ask for a date with a month grid: seven columns,
 * five or six rows, drawn twice — once for the pickup and again for the
 * delivery. A month is the right shape for a question like "which Tuesday in
 * March", and the wrong shape for this one. Nearly every booking is today,
 * tomorrow, or this weekend, and the grid buried those three answers somewhere
 * in thirty-five squares of which most were greyed out and unbookable. Worse,
 * it made the customer read a calendar to find *tomorrow* — a fact they
 * already knew before the page loaded.
 *
 * A rail states them in order of nearness instead. The likeliest answer is
 * first, the next is beside it, and the far end of the window is a swipe away.
 * Only selectable days are listed, so there is nothing on screen that cannot
 * be chosen — the grid spent most of its area on days it then refused.
 *
 * `now` is passed in rather than read from the clock, so a label can be tested
 * without the answer depending on the day CI happens to run.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RailDay {
  /** Days from today. 0 is today. */
  dayOffset: number;
  /**
   * The word above the number. Today and tomorrow are named; everything else
   * gets its weekday, because "in 4 days" makes a customer count on fingers.
   */
  lead: string;
  dayOfMonth: number;
  /**
   * The month, on the first card and again wherever the month turns over.
   *
   * A rail of bare numbers running 29, 30, 1, 2 is ambiguous exactly where it
   * matters most. Repeating the month on every card would be noise; naming it
   * only where it changes is the fact, said once.
   */
  month: string | null;
  isToday: boolean;
}

/** The date `offset` days from `now`, at midnight. */
function dateAt(offset: number, now: Date): Date {
  const date = new Date(now.getTime() + offset * DAY_MS);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Every day the shop will take, from the nearest to the furthest.
 *
 * A range that runs backwards yields nothing rather than throwing: while a
 * customer is moving the pickup around, a delivery leg can be asked for a
 * window that has momentarily inverted, and an empty rail is a truthful answer
 * to "which days are left" where a crash is not.
 */
export function railDays(minOffset: number, maxOffset: number, now: Date): RailDay[] {
  const days: RailDay[] = [];
  let lastMonth: number | null = null;

  for (let offset = Math.max(0, minOffset); offset <= maxOffset; offset += 1) {
    const date = dateAt(offset, now);
    const month = date.getMonth();
    days.push({
      dayOffset: offset,
      lead:
        offset === 0
          ? 'Today'
          : offset === 1
            ? 'Tomorrow'
            : date.toLocaleDateString(undefined, { weekday: 'short' }),
      dayOfMonth: date.getDate(),
      month: month === lastMonth ? null : date.toLocaleDateString(undefined, { month: 'short' }),
      isToday: offset === 0,
    });
    lastMonth = month;
  }

  return days;
}

/**
 * Where the chosen day sits in the rail, so the rail can open showing it.
 *
 * -1 when the chosen day is not in the rail at all, which happens for the
 * instant between a pickup moving and the delivery being nudged after it.
 */
export function railIndexOf(days: readonly RailDay[], dayOffset: number): number {
  return days.findIndex((day) => day.dayOffset === dayOffset);
}
