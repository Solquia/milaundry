import {
  DEFAULT_SHOP_HOURS,
  addDays,
  bookingCutoff,
  dayName,
  daysBetween,
  pickupWindows,
  reconcileReturn,
  returnWindows,
  shopSlotOf,
  shopToday,
  slotInstant,
  slotProblems,
  slotSummary,
  stripDays,
  suggestSchedule,
  turnaroundText,
  windowEnd,
  windowLabel,
  windowPart,
  type ShopHours,
} from '../rider-calendar';

/**
 * Every instant here is written in UTC and read in Manila (UTC+8), so the
 * answers cannot drift with the time zone of the machine running the tests —
 * which is the bug these tests exist for.
 */
/** Friday 25 Sep 2026, 2 PM in Manila. */
const FRI_2PM = new Date('2026-09-25T06:00:00Z');
/** Friday 25 Sep 2026, 9 PM in Manila — every pickup today is gone. */
const FRI_9PM = new Date('2026-09-25T13:00:00Z');
/** Saturday 26 Sep 2026, 12:30 AM in Manila, still Friday in UTC. */
const SAT_0030 = new Date('2026-09-25T16:30:00Z');

const HOURS = DEFAULT_SHOP_HOURS;
const SUNDAYS_OFF: ShopHours = { ...HOURS, closedWeekdays: [0] };

describe('the shop clock', () => {
  it("counts days on the shop's calendar, not the device's", () => {
    expect(shopToday(FRI_2PM, HOURS)).toBe('2026-09-25');
    // Past midnight in Manila while UTC still says Friday.
    expect(shopToday(SAT_0030, HOURS)).toBe('2026-09-26');
  });

  it('walks days across a month end', () => {
    expect(addDays('2026-09-29', 3)).toBe('2026-10-02');
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30');
    expect(daysBetween('2026-09-25', '2026-10-02')).toBe(7);
  });

  it('turns a slot into the exact instant a rider is due', () => {
    expect(slotInstant({ day: '2026-09-26', hour: 14 }, HOURS).toISOString()).toBe(
      '2026-09-26T06:00:00.000Z'
    );
  });

  it('reads an instant back as a shop day and hour', () => {
    expect(shopSlotOf(FRI_2PM, HOURS)).toEqual({ day: '2026-09-25', hour: 14 });
  });
});

describe('windows', () => {
  it('names a window by both ends, so nobody waits at the gate for the first minute', () => {
    expect(windowLabel(8, HOURS)).toBe('8–10 AM');
    expect(windowLabel(10, HOURS)).toBe('10 AM–12 PM');
    expect(windowLabel(12, HOURS)).toBe('12–2 PM');
    expect(windowLabel(14, HOURS)).toBe('2–4 PM');
    expect(windowLabel(18, HOURS)).toBe('6–8 PM');
  });

  it('ends a window its length after it starts', () => {
    expect(windowEnd(14, HOURS)).toBe(16);
  });

  it('files each window under a part of the day', () => {
    expect(windowPart(8)).toBe('morning');
    expect(windowPart(10)).toBe('morning');
    expect(windowPart(12)).toBe('afternoon');
    expect(windowPart(14)).toBe('afternoon');
    expect(windowPart(16)).toBe('evening');
    expect(windowPart(18)).toBe('evening');
  });
});

describe('naming a day', () => {
  it('says today and tomorrow, and the weekday after that', () => {
    expect(dayName('2026-09-25', '2026-09-25')).toBe('Today');
    expect(dayName('2026-09-26', '2026-09-25')).toBe('Tomorrow');
    expect(dayName('2026-09-27', '2026-09-25')).toBe('Sun');
  });

  it('says a whole slot as one sentence', () => {
    expect(slotSummary({ day: '2026-09-26', hour: 14 }, '2026-09-25', HOURS)).toBe(
      'Tomorrow · 2–4 PM'
    );
    expect(slotSummary({ day: '2026-09-28', hour: 8 }, '2026-09-25', HOURS)).toBe(
      'Mon 28 Sep · 8–10 AM'
    );
  });
});

describe('pickupWindows', () => {
  it('shuts windows a rider can no longer make, and says why', () => {
    const windows = pickupWindows('2026-09-25', FRI_2PM, HOURS);
    expect(windows.filter((w) => w.isOpen).map((w) => w.hour)).toEqual([16, 18]);
    expect(windows.find((w) => w.hour === 14)?.reason).toBe('passed');
  });

  it('opens every window on a later day', () => {
    const windows = pickupWindows('2026-09-26', FRI_2PM, HOURS);
    expect(windows.every((w) => w.isOpen)).toBe(true);
  });

  it('shuts a whole day the shop is closed', () => {
    const windows = pickupWindows('2026-09-27', FRI_2PM, SUNDAYS_OFF);
    expect(windows.every((w) => !w.isOpen && w.reason === 'closed')).toBe(true);
  });

  it('offers nothing past the booking window', () => {
    const far = addDays('2026-09-25', HOURS.pickupDays + 1);
    expect(pickupWindows(far, FRI_2PM, HOURS).some((w) => w.isOpen)).toBe(false);
  });
});

describe('returnWindows', () => {
  it('holds the laundry for the time it takes to wash it', () => {
    // Collected 8–10 AM, four hours in the machines: back from 2 PM.
    const pickup = { day: '2026-09-26', hour: 8 };
    const windows = returnWindows('2026-09-26', pickup, FRI_2PM, HOURS);
    expect(windows.filter((w) => w.isOpen).map((w) => w.hour)).toEqual([14, 16, 18]);
    expect(windows.find((w) => w.hour === 12)?.reason).toBe('washing');
  });

  it('pushes a late pickup to the next day', () => {
    const pickup = { day: '2026-09-25', hour: 16 };
    expect(returnWindows('2026-09-25', pickup, FRI_2PM, HOURS).some((w) => w.isOpen)).toBe(false);
    expect(returnWindows('2026-09-26', pickup, FRI_2PM, HOURS).every((w) => w.isOpen)).toBe(true);
  });

  it('counts its own window from the pickup, not from today', () => {
    const pickup = { day: '2026-09-30', hour: 8 };
    const last = addDays('2026-09-30', HOURS.returnDays);
    expect(returnWindows(last, pickup, FRI_2PM, HOURS).some((w) => w.isOpen)).toBe(true);
    expect(returnWindows(addDays(last, 1), pickup, FRI_2PM, HOURS).some((w) => w.isOpen)).toBe(
      false
    );
  });
});

describe('stripDays', () => {
  it('lays out a week from where it starts, with what each day has left', () => {
    const days = stripDays('2026-09-25', '2026-09-25', (day) =>
      pickupWindows(day, FRI_2PM, SUNDAYS_OFF)
    );
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ day: '2026-09-25', isToday: true, openCount: 2, status: 'open' });
    expect(days[2]).toMatchObject({ day: '2026-09-27', status: 'closed', openCount: 0 });
    expect(days[6].day).toBe('2026-10-01');
  });

  it('marks a day whose windows have all gone as done', () => {
    const [today] = stripDays('2026-09-25', '2026-09-25', (day) =>
      pickupWindows(day, FRI_9PM, HOURS)
    );
    expect(today.status).toBe('done');
  });

  it('names the month on the first card and where it turns over', () => {
    const days = stripDays('2026-09-28', '2026-09-25', (day) =>
      pickupWindows(day, FRI_2PM, HOURS)
    );
    expect(days.map((d) => d.month)).toEqual(['Sep', null, null, 'Oct', null, null, null]);
  });
});

describe('suggestSchedule', () => {
  it('opens on the soonest pickup, back a day later at the same time', () => {
    expect(suggestSchedule(FRI_2PM, HOURS)).toEqual({
      pickup: { day: '2026-09-25', hour: 16 },
      deliver: { day: '2026-09-26', hour: 16 },
    });
  });

  it('rolls to tomorrow morning once today is gone', () => {
    expect(suggestSchedule(FRI_9PM, HOURS)?.pickup).toEqual({ day: '2026-09-26', hour: 8 });
  });

  it('keeps last time’s hour when a rider can still make it', () => {
    expect(suggestSchedule(FRI_2PM, HOURS, 10)?.pickup).toEqual({ day: '2026-09-26', hour: 10 });
  });

  it('steps over a day the shop is closed', () => {
    // Saturday night: Sunday is shut, so Monday.
    const satNight = new Date('2026-09-26T13:00:00Z');
    expect(suggestSchedule(satNight, SUNDAYS_OFF)).toEqual({
      pickup: { day: '2026-09-28', hour: 8 },
      deliver: { day: '2026-09-29', hour: 8 },
    });
  });
});

describe('reconcileReturn', () => {
  it('leaves a return that still works exactly where it was put', () => {
    const pickup = { day: '2026-09-26', hour: 8 };
    const ret = { day: '2026-09-29', hour: 12 };
    expect(reconcileReturn(pickup, ret, FRI_2PM, HOURS)).toEqual(ret);
  });

  it('moves the return past a pickup that overtook it, keeping its hour', () => {
    const pickup = { day: '2026-09-28', hour: 10 };
    expect(reconcileReturn(pickup, { day: '2026-09-26', hour: 12 }, FRI_2PM, HOURS)).toEqual({
      day: '2026-09-29',
      hour: 12,
    });
  });

  it('slides a same-day return forward to the first time the wash is done', () => {
    // Pickup moved to 12–2 PM; a 4 PM return is now too soon, 6 PM is not.
    const pickup = { day: '2026-09-26', hour: 12 };
    expect(reconcileReturn(pickup, { day: '2026-09-26', hour: 16 }, FRI_2PM, HOURS)).toEqual({
      day: '2026-09-26',
      hour: 18,
    });
  });
});

describe('slotProblems', () => {
  it('is empty for a schedule that works', () => {
    expect(
      slotProblems({ day: '2026-09-25', hour: 16 }, { day: '2026-09-26', hour: 16 }, FRI_2PM, HOURS)
    ).toEqual({});
  });

  it('says when the pickup has slipped into the past', () => {
    const problems = slotProblems(
      { day: '2026-09-25', hour: 14 },
      { day: '2026-09-26', hour: 14 },
      FRI_2PM,
      HOURS
    );
    expect(problems.pickupAt).toMatch(/passed/i);
  });

  it('says when the shop is closed that day', () => {
    const problems = slotProblems(
      { day: '2026-09-27', hour: 10 },
      { day: '2026-09-28', hour: 10 },
      FRI_2PM,
      SUNDAYS_OFF
    );
    expect(problems.pickupAt).toMatch(/closed/i);
  });

  it('says when the laundry would come back before it is washed', () => {
    const problems = slotProblems(
      { day: '2026-09-26', hour: 8 },
      { day: '2026-09-26', hour: 10 },
      FRI_2PM,
      HOURS
    );
    expect(problems.deliverBy).toMatch(/2 PM/);
  });
});

describe('turnaroundText', () => {
  it('says roughly how long the shop keeps it', () => {
    const pickup = { day: '2026-09-26', hour: 8 };
    expect(turnaroundText(pickup, { day: '2026-09-26', hour: 14 })).toBe('About 6 hours');
    expect(turnaroundText(pickup, { day: '2026-09-27', hour: 8 })).toBe('About 1 day');
    expect(turnaroundText(pickup, { day: '2026-09-28', hour: 14 })).toBe('About 2 days');
  });
});

describe('bookingCutoff', () => {
  it("says the last minute to book today's last pickup", () => {
    expect(bookingCutoff(FRI_2PM, HOURS)).toBe('5 PM');
    expect(bookingCutoff(FRI_2PM, { ...HOURS, leadMinutes: 90 })).toBe('4:30 PM');
  });

  it('is null once today has nothing left', () => {
    expect(bookingCutoff(FRI_9PM, HOURS)).toBeNull();
  });
});
