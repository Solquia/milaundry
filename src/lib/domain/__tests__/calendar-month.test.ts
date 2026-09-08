import {
  WEEKDAY_INITIALS,
  dayOffsetOf,
  hasSelectableDay,
  monthGrid,
  monthLabel,
  monthOf,
  shiftMonth,
} from '../calendar-month';

/** Tuesday 12 May 2026, nine in the morning. May 2026 starts on a Friday. */
const NOW = new Date(2026, 4, 12, 9, 0);
const MAY = { year: 2026, month: 4 };
const WINDOW = { min: 0, max: 30 };

const grid = (cursor: { year: number; month: number }) =>
  monthGrid(cursor, NOW, WINDOW.min, WINDOW.max);

/** The cell for a day of the month, or undefined if the grid has no such day. */
const cell = (cursor: { year: number; month: number }, dayOfMonth: number) =>
  grid(cursor)
    .flat()
    .find((it) => it.kind === 'day' && it.dayOfMonth === dayOfMonth);

describe('monthGrid', () => {
  it('lays the month out in whole weeks, so the columns are weekdays', () => {
    // Every row is seven cells or the weekday header stops lining up with the
    // days beneath it, which is the one thing a calendar has to get right.
    for (const week of grid(MAY)) expect(week).toHaveLength(7);
  });

  it('pads the first row up to the weekday the month starts on', () => {
    // May 2026 opens on a Friday, so Sunday through Thursday are blank.
    const first = grid(MAY)[0];
    expect(first.slice(0, 5).every((it) => it.kind === 'pad')).toBe(true);
    expect(first[5]).toMatchObject({ kind: 'day', dayOfMonth: 1 });
    expect(first[6]).toMatchObject({ kind: 'day', dayOfMonth: 2 });
  });

  it('holds every day of the month exactly once', () => {
    const days = grid(MAY).flat().filter((it) => it.kind === 'day');
    expect(days).toHaveLength(31);
  });

  it('marks today', () => {
    expect(cell(MAY, 12)).toMatchObject({ isToday: true });
    expect(cell(MAY, 13)).toMatchObject({ isToday: false });
  });

  it('counts each day as an offset from today, which is what a booking stores', () => {
    expect(cell(MAY, 15)).toMatchObject({ dayOffset: 3 });
    expect(cell(MAY, 11)).toMatchObject({ dayOffset: -1 });
  });

  it('will not let you book a day that has already gone', () => {
    expect(cell(MAY, 11)).toMatchObject({ isSelectable: false });
    expect(cell(MAY, 12)).toMatchObject({ isSelectable: true });
  });

  it('stops at the end of the booking window rather than offering the whole year', () => {
    // Thirty days out is the last day the shop accepts; the next one is not a
    // day the customer may choose, so it must not look like one.
    expect(cell({ year: 2026, month: 5 }, 11)).toMatchObject({
      dayOffset: 30,
      isSelectable: true,
    });
    expect(cell({ year: 2026, month: 5 }, 12)).toMatchObject({
      dayOffset: 31,
      isSelectable: false,
    });
  });

  it('honours a floor above today, which is how delivery stays after pickup', () => {
    // The delivery leg's earliest day is the pickup, not today.
    const laterFloor = monthGrid(MAY, NOW, 3, 30)
      .flat()
      .filter((it) => it.kind === 'day' && it.isSelectable)
      .map((it) => it.dayOfMonth);
    expect(laterFloor[0]).toBe(15);
  });
});

describe('monthLabel', () => {
  it('names the month alone inside the current year', () => {
    expect(monthLabel(MAY, NOW)).toBe('May');
  });

  it('adds the year once the calendar has walked into a different one', () => {
    // "January" on its own, paged forward from December, is a lie about which
    // January it is.
    expect(monthLabel({ year: 2027, month: 0 }, NOW)).toBe('January 2027');
  });
});

describe('shiftMonth', () => {
  it('steps forward a month', () => {
    expect(shiftMonth(MAY, 1)).toEqual({ year: 2026, month: 5 });
  });

  it('rolls into the next year rather than off the end of December', () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
  });

  it('rolls back into the previous year', () => {
    expect(shiftMonth({ year: 2027, month: 0 }, -1)).toEqual({ year: 2026, month: 11 });
  });
});

describe('hasSelectableDay', () => {
  it('is true for a month holding a day you may book', () => {
    expect(hasSelectableDay(MAY, NOW, WINDOW.min, WINDOW.max)).toBe(true);
  });

  it('is false for a month already behind you', () => {
    // The arrow that leads there is hidden rather than disabled: an arrow that
    // pages to a month of dead days is an arrow that lied.
    expect(hasSelectableDay({ year: 2026, month: 3 }, NOW, WINDOW.min, WINDOW.max)).toBe(
      false
    );
  });

  it('is false for a month past the end of the window', () => {
    expect(hasSelectableDay({ year: 2026, month: 6 }, NOW, WINDOW.min, WINDOW.max)).toBe(
      false
    );
  });
});

describe('monthOf and dayOffsetOf', () => {
  it('finds the month a chosen day lives in, so the calendar opens on it', () => {
    expect(monthOf(3, NOW)).toEqual(MAY);
    expect(monthOf(30, NOW)).toEqual({ year: 2026, month: 5 });
  });

  it('turns a day of the month back into the offset a booking stores', () => {
    expect(dayOffsetOf(MAY, 15, NOW)).toBe(3);
    expect(dayOffsetOf({ year: 2026, month: 5 }, 1, NOW)).toBe(20);
  });
});

describe('WEEKDAY_INITIALS', () => {
  it('labels seven columns starting on Sunday', () => {
    expect(WEEKDAY_INITIALS).toEqual(['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']);
  });
});
