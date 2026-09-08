import {
  BOOKING_WINDOW_DAYS,
  dayLabel,
  hourLabel,
  keepDeliveryAfterPickup,
  slotSummary,
  turnaroundLabel,
  turnaroundNote,
} from '../booking-slot';

// A fixed Wednesday afternoon, so "tomorrow" is never whatever day CI runs on.
const NOW = new Date('2026-08-26T13:00:00');

describe('dayLabel', () => {
  it('names the two days a customer thinks in', () => {
    expect(dayLabel(0, NOW)).toBe('Today');
    expect(dayLabel(1, NOW)).toBe('Tomorrow');
  });

  it('dates anything further out, because "in 3 days" is a puzzle', () => {
    const label = dayLabel(3, NOW);
    expect(label).not.toBe('Today');
    expect(label).toMatch(/\d/);
  });
});

describe('hourLabel', () => {
  it('speaks in the 12-hour clock the shop uses', () => {
    expect(hourLabel(8)).toBe('8 AM');
    expect(hourLabel(14)).toBe('2 PM');
  });

  it('gets the two hours that break naive modulo right', () => {
    expect(hourLabel(12)).toBe('12 PM');
    expect(hourLabel(0)).toBe('12 AM');
  });
});

describe('slotSummary', () => {
  it('states the choice as something you could say out loud', () => {
    // The picker showed two rows of chips and left the customer to assemble
    // "Tomorrow" + "4 PM" in their head. This is the sentence they were making.
    expect(slotSummary({ dayOffset: 1, hour: 16 }, NOW)).toBe('Tomorrow, 4 PM');
    expect(slotSummary({ dayOffset: 0, hour: 8 }, NOW)).toBe('Today, 8 AM');
  });

  it('uses the same words the chips use', () => {
    const slot = { dayOffset: 1, hour: 10 };
    expect(slotSummary(slot, NOW)).toContain(dayLabel(slot.dayOffset, NOW));
    expect(slotSummary(slot, NOW)).toContain(hourLabel(slot.hour));
  });
});

describe('turnaroundLabel', () => {
  it('names the wait in the words a counter uses', () => {
    expect(turnaroundLabel({ dayOffset: 0, hour: 8 }, { dayOffset: 0, hour: 18 })).toBe(
      'Same day'
    );
    expect(turnaroundLabel({ dayOffset: 0, hour: 8 }, { dayOffset: 1, hour: 8 })).toBe(
      'Next day'
    );
  });

  it('counts the days once it is more than one', () => {
    expect(turnaroundLabel({ dayOffset: 0, hour: 8 }, { dayOffset: 3, hour: 8 })).toBe(
      'In 3 days'
    );
  });

  it('does not invent a wait when delivery is set before pickup', () => {
    // Validation rejects this ordering; the label must not meanwhile claim
    // "In -1 days" while the customer is still moving the chips around.
    expect(turnaroundLabel({ dayOffset: 2, hour: 8 }, { dayOffset: 1, hour: 8 })).toBe(
      'Same day'
    );
  });
});

describe('turnaroundNote', () => {
  it('says the wait once, so the two pickers do not have to imply it', () => {
    expect(turnaroundNote({ dayOffset: 0, hour: 8 }, { dayOffset: 0, hour: 18 })).toBe(
      'Back the same day we collect it.'
    );
    expect(turnaroundNote({ dayOffset: 0, hour: 8 }, { dayOffset: 1, hour: 8 })).toBe(
      'Back the day after we collect it.'
    );
  });

  it('counts the days out loud once it is more than one', () => {
    expect(turnaroundNote({ dayOffset: 0, hour: 8 }, { dayOffset: 3, hour: 8 })).toBe(
      'Back 3 days after we collect it.'
    );
  });

  it('does not narrate a negative wait mid-edit', () => {
    expect(turnaroundNote({ dayOffset: 2, hour: 8 }, { dayOffset: 1, hour: 8 })).toBe(
      'Back the same day we collect it.'
    );
  });
});

describe('keepDeliveryAfterPickup', () => {
  it('leaves a delivery that is already later alone', () => {
    const deliver = { dayOffset: 2, hour: 10 };
    expect(keepDeliveryAfterPickup(deliver, { dayOffset: 0, hour: 16 })).toEqual(deliver);
  });

  it('nudges delivery past a pickup that overtook it', () => {
    expect(
      keepDeliveryAfterPickup({ dayOffset: 1, hour: 10 }, { dayOffset: 2, hour: 8 })
    ).toEqual({ dayOffset: 3, hour: 10 });
  });

  it('treats the same day as not yet after', () => {
    expect(
      keepDeliveryAfterPickup({ dayOffset: 2, hour: 10 }, { dayOffset: 2, hour: 8 })
    ).toEqual({ dayOffset: 3, hour: 10 });
  });

  it('leaves a delivery a week out where the customer put it', () => {
    // This used to be yanked back to pickup + 3, because the delivery leg was
    // four chips wide and a day without a chip rendered as nothing selected.
    // The calendar offers a month, so a long turnaround is now a real answer
    // rather than an unreachable one.
    expect(
      keepDeliveryAfterPickup({ dayOffset: 9, hour: 10 }, { dayOffset: 3, hour: 8 })
    ).toEqual({ dayOffset: 9, hour: 10 });
  });

  it('clamps to the far end of the booking window', () => {
    // Past the window there is no selectable day, and a leg pointing at one
    // would render with nothing chosen.
    expect(
      keepDeliveryAfterPickup({ dayOffset: 400, hour: 10 }, { dayOffset: 3, hour: 8 })
    ).toEqual({ dayOffset: 3 + BOOKING_WINDOW_DAYS, hour: 10 });
  });

  it('never moves the hour the customer chose', () => {
    expect(
      keepDeliveryAfterPickup({ dayOffset: 1, hour: 18 }, { dayOffset: 5, hour: 8 }).hour
    ).toBe(18);
  });
});
