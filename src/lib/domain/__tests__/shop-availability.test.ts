import {
  DEFAULT_DAY,
  UNTIL_REOPENED,
  formatClock,
  pauseChoices,
  readAvailability,
  setDayHours,
  shopStatus,
  shopToday,
  stepTime,
  upcomingClosures,
  validateClosure,
  weekOrDefault,
  type Availability,
  type WeekHours,
} from '../shop-availability';

/** Friday 25 Sep 2026, 2 PM in Manila. */
const FRI_2PM = new Date('2026-09-25T06:00:00Z');
const FRI_630PM = new Date('2026-09-25T10:30:00Z');
const FRI_8PM = new Date('2026-09-25T12:00:00Z');
const SAT_8PM = new Date('2026-09-26T12:00:00Z');

/** 8 AM to 7 PM every day but Sunday. */
const WEEK: WeekHours = [null, DEFAULT_DAY, DEFAULT_DAY, DEFAULT_DAY, DEFAULT_DAY, DEFAULT_DAY, DEFAULT_DAY];

function availability(overrides: Partial<Availability> = {}): Availability {
  return { hours: WEEK, pausedUntil: null, pauseNote: '', closures: [], ...overrides };
}

describe('shopStatus', () => {
  it('reads a shop with no hours set as open, with no closing time to show', () => {
    const status = shopStatus(availability({ hours: null }), FRI_2PM);
    expect(status).toMatchObject({ state: 'open', isTakingOrders: true, label: 'Open', detail: null });
  });

  it('says when an open shop closes', () => {
    expect(shopStatus(availability(), FRI_2PM)).toMatchObject({
      state: 'open',
      isTakingOrders: true,
      detail: 'until 7:00 PM',
    });
  });

  it('warns in the last hour before closing', () => {
    expect(shopStatus(availability(), FRI_630PM)).toMatchObject({
      state: 'closing-soon',
      label: 'Closing soon',
      detail: 'until 7:00 PM',
    });
  });

  it('after hours, still takes orders to book ahead and says when it opens', () => {
    expect(shopStatus(availability(), FRI_8PM)).toMatchObject({
      state: 'closed',
      isTakingOrders: true,
      label: 'Closed',
      detail: 'opens tomorrow 8:00 AM',
    });
  });

  it('skips a closed weekday when saying when it opens', () => {
    expect(shopStatus(availability(), SAT_8PM).detail).toBe('opens Mon 8:00 AM');
  });

  it('a paused shop takes no orders and says when it is back', () => {
    const status = shopStatus(
      availability({ pausedUntil: new Date('2026-09-25T07:00:00Z') }),
      FRI_2PM
    );
    expect(status).toMatchObject({
      state: 'paused',
      isTakingOrders: false,
      label: 'Closed for now',
      detail: 'back 3:00 PM',
    });
  });

  it('a shop paused until reopened shows its note instead of a time', () => {
    const status = shopStatus(
      availability({ pausedUntil: UNTIL_REOPENED, pauseNote: 'Water interruption' }),
      FRI_2PM
    );
    expect(status).toMatchObject({ state: 'paused', detail: 'Water interruption' });
  });

  it('a pause that has run out is ignored', () => {
    const status = shopStatus(
      availability({ pausedUntil: new Date('2026-09-25T05:00:00Z') }),
      FRI_2PM
    );
    expect(status.state).toBe('open');
  });

  it('a closure covering today shuts the shop and says when it is back', () => {
    const status = shopStatus(
      availability({ closures: [{ from: '2026-09-25', to: '2026-09-26', note: 'Fiesta' }] }),
      FRI_2PM
    );
    expect(status).toMatchObject({
      state: 'holiday',
      isTakingOrders: false,
      label: 'Closed today',
      detail: 'Fiesta · back Mon 8:00 AM',
    });
  });

  it('a long closure with no hours set names the day it ends', () => {
    const status = shopStatus(
      availability({
        hours: null,
        closures: [{ from: '2026-09-20', to: '2026-10-04', note: '' }],
      }),
      FRI_2PM
    );
    expect(status.detail).toBe('back Oct 5');
  });
});

describe('readAvailability', () => {
  it('reads a well-formed row', () => {
    const read = readAvailability({
      hours: [null, { opens: 480, closes: 1140 }, null, null, null, null, null],
      paused_until: '2026-09-25T07:00:00Z',
      pause_note: 'Lunch',
      closures: [{ from: '2026-12-24', to: '2026-12-26', note: 'Christmas' }],
    });
    expect(read.hours?.[1]).toEqual({ opens: 480, closes: 1140 });
    expect(read.pausedUntil?.toISOString()).toBe('2026-09-25T07:00:00.000Z');
    expect(read.pauseNote).toBe('Lunch');
    expect(read.closures).toHaveLength(1);
  });

  it('treats a row from before the columns existed as always open', () => {
    expect(readAvailability({})).toEqual({
      hours: null,
      pausedUntil: null,
      pauseNote: '',
      closures: [],
    });
  });

  it('drops malformed hours and closures rather than guessing', () => {
    const read = readAvailability({
      hours: [{ opens: 900, closes: 100 }],
      paused_until: 'not a date',
      closures: [{ from: 'soon' }, 'x'],
    });
    expect(read.hours).toBeNull();
    expect(read.pausedUntil).toBeNull();
    expect(read.closures).toEqual([]);
  });
});

describe('pauseChoices', () => {
  it('offers short breaks, the rest of today, and until reopened', () => {
    const choices = pauseChoices(availability(), FRI_2PM);
    expect(choices.map((c) => c.key)).toEqual(['30m', '1h', 'today', 'reopen']);
    expect(choices[1].until.toISOString()).toBe('2026-09-25T07:00:00.000Z');
    // Saturday 8 AM in Manila.
    expect(choices[2].until.toISOString()).toBe('2026-09-26T00:00:00.000Z');
    expect(choices[3].until).toBe(UNTIL_REOPENED);
  });

  it('with no hours set, the rest of today runs to midnight', () => {
    const choices = pauseChoices(availability({ hours: null }), FRI_2PM);
    expect(choices[2].until.toISOString()).toBe('2026-09-25T16:00:00.000Z');
  });
});

describe('editing helpers', () => {
  it('setDayHours returns a new week and leaves the old one alone', () => {
    const next = setDayHours(WEEK, 0, DEFAULT_DAY);
    expect(next[0]).toEqual(DEFAULT_DAY);
    expect(WEEK[0]).toBeNull();
  });

  it('weekOrDefault fills a shop with no hours with 8 to 7 every day', () => {
    expect(weekOrDefault(null)).toHaveLength(7);
    expect(weekOrDefault(null).every((d) => d?.opens === 480)).toBe(true);
  });

  it('stepTime moves in half hours and stays inside the day', () => {
    expect(stepTime(480, 1)).toBe(510);
    expect(stepTime(0, -1)).toBe(0);
    expect(stepTime(1440, 1)).toBe(1440);
  });

  it('formatClock reads minutes as a wall-clock time', () => {
    expect(formatClock(0)).toBe('12:00 AM');
    expect(formatClock(750)).toBe('12:30 PM');
    expect(formatClock(1140)).toBe('7:00 PM');
    expect(formatClock(1440)).toBe('12:00 AM');
  });

  it('shopToday is the date on the shop wall, not UTC', () => {
    // 11 PM UTC Friday is already Saturday in Manila.
    expect(shopToday(new Date('2026-09-25T23:00:00Z'))).toBe('2026-09-26');
  });
});

describe('closures', () => {
  it('validateClosure refuses an end before the start, a past date, and a long note', () => {
    expect(validateClosure({ from: '2026-10-02', to: '2026-10-01', note: '' }, FRI_2PM)).toMatch(
      /end/i
    );
    expect(validateClosure({ from: '2026-09-20', to: '2026-09-21', note: '' }, FRI_2PM)).toMatch(
      /past/i
    );
    expect(
      validateClosure({ from: '2026-10-01', to: '2026-10-01', note: 'x'.repeat(41) }, FRI_2PM)
    ).toMatch(/short/i);
    expect(validateClosure({ from: 'Oct 1', to: '2026-10-01', note: '' }, FRI_2PM)).toMatch(/date/i);
    expect(validateClosure({ from: '2026-09-25', to: '2026-09-25', note: 'Fiesta' }, FRI_2PM)).toBeNull();
  });

  it('upcomingClosures drops the ones that are over and sorts the rest', () => {
    const list = upcomingClosures(
      [
        { from: '2026-12-24', to: '2026-12-26', note: 'Christmas' },
        { from: '2026-09-01', to: '2026-09-02', note: 'Old' },
        { from: '2026-11-01', to: '2026-11-01', note: 'Undas' },
      ],
      FRI_2PM
    );
    expect(list.map((c) => c.note)).toEqual(['Undas', 'Christmas']);
  });
});
