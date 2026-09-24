import {
  MIN_BOOKING_WEIGHT_KG,
  deliveryHours,
  openHours,
  slotProblems,
  suggestSchedule,
  validateBookingLoad,
  validateDeliveryAddress,
} from '../booking-validation';

// Local-time clocks, so the answers do not depend on the machine's zone.
const morning = new Date(2026, 8, 24, 10, 0);
const evening = new Date(2026, 8, 24, 17, 30);

const perKg = { id: 's-wash', unit: 'per_kg' as const };
const perItem = { id: 's-comf', unit: 'per_item' as const };
const catalog = [perKg, perItem, { id: 's-rug', unit: 'per_kg' as const }];

describe('validateBookingLoad', () => {
  it('accepts an ordinary load', () => {
    expect(validateBookingLoad({ service: perKg, quantity: 5, addOns: {}, catalog })).toBeNull();
  });

  it('asks for a weight when nothing is chosen', () => {
    expect(validateBookingLoad({ service: perKg, quantity: 0, addOns: {}, catalog })).toMatch(
      /how heavy/i
    );
  });

  it('allows an add-on-only booking', () => {
    expect(
      validateBookingLoad({ service: perKg, quantity: 0, addOns: { 's-comf': 1 }, catalog })
    ).toBeNull();
  });

  it('refuses a load under the minimum weight', () => {
    expect(MIN_BOOKING_WEIGHT_KG).toBe(1);
    expect(validateBookingLoad({ service: perKg, quantity: 0.5, addOns: {}, catalog })).toMatch(
      /smallest load.*1 kg/i
    );
  });

  it('refuses more than one booking can carry', () => {
    expect(validateBookingLoad({ service: perKg, quantity: 31, addOns: {}, catalog })).toMatch(
      /more than 30 kg/i
    );
  });

  it('counts per-kilo add-ons toward the limit', () => {
    expect(
      validateBookingLoad({ service: perKg, quantity: 25, addOns: { 's-rug': 6 }, catalog })
    ).toMatch(/more than 30 kg/i);
  });

  it('asks for at least one piece on a per-item service', () => {
    expect(validateBookingLoad({ service: perItem, quantity: 0, addOns: {}, catalog })).toMatch(
      /at least one/i
    );
  });
});

describe('validateDeliveryAddress', () => {
  it('accepts a real street address', () => {
    expect(validateDeliveryAddress('12 Mabini St, Quezon City')).toBeNull();
  });

  it('asks for an address when there is none', () => {
    expect(validateDeliveryAddress('   ')).toBe('Enter the pickup & delivery address.');
  });

  it('refuses something too short to find', () => {
    expect(validateDeliveryAddress('12 A')).toMatch(/incomplete/i);
  });

  it('refuses digits and punctuation with no street name', () => {
    expect(validateDeliveryAddress('1234 5678 90')).toMatch(/incomplete/i);
  });

  it('refuses an address longer than the column holds', () => {
    expect(validateDeliveryAddress(`12 Mabini St ${'x'.repeat(300)}`)).toMatch(/300/);
  });
});

describe('openHours', () => {
  it('keeps only hours at least an hour away today', () => {
    expect(openHours(0, morning)).toEqual([12, 14, 16, 18]);
  });

  it('has nothing left late in the day', () => {
    expect(openHours(0, evening)).toEqual([]);
  });

  it('offers every hour on a later day', () => {
    expect(openHours(1, evening)).toEqual([8, 10, 12, 14, 16, 18]);
  });

  it('offers nothing past the booking window', () => {
    expect(openHours(31, morning)).toEqual([]);
  });
});

describe('deliveryHours', () => {
  it('only offers same-day hours after pickup', () => {
    expect(deliveryHours(1, { dayOffset: 1, hour: 14 }, morning)).toEqual([16, 18]);
  });

  it('offers the whole next day', () => {
    expect(deliveryHours(2, { dayOffset: 1, hour: 18 }, morning)).toEqual([8, 10, 12, 14, 16, 18]);
  });

  it('offers nothing on a day before pickup', () => {
    expect(deliveryHours(0, { dayOffset: 1, hour: 8 }, morning)).toEqual([]);
  });
});

describe('suggestSchedule', () => {
  it('picks the first open pickup today and delivery a day later', () => {
    expect(suggestSchedule(morning)).toEqual({
      pickup: { dayOffset: 0, hour: 12 },
      deliver: { dayOffset: 1, hour: 12 },
    });
  });

  it('rolls to tomorrow once today is full', () => {
    expect(suggestSchedule(evening)).toEqual({
      pickup: { dayOffset: 1, hour: 8 },
      deliver: { dayOffset: 2, hour: 8 },
    });
  });

  it('keeps the hour the customer used last time when it is open', () => {
    expect(suggestSchedule(morning, 16)).toEqual({
      pickup: { dayOffset: 0, hour: 16 },
      deliver: { dayOffset: 1, hour: 16 },
    });
  });

  it('moves to the next day that has the preferred hour', () => {
    expect(suggestSchedule(morning, 8)).toEqual({
      pickup: { dayOffset: 1, hour: 8 },
      deliver: { dayOffset: 2, hour: 8 },
    });
  });
});

describe('slotProblems', () => {
  it('is quiet for a good pair', () => {
    expect(
      slotProblems({ dayOffset: 0, hour: 14 }, { dayOffset: 1, hour: 14 }, morning)
    ).toEqual({});
  });

  it('says when no pickup times are left today', () => {
    expect(
      slotProblems({ dayOffset: 0, hour: 18 }, { dayOffset: 1, hour: 14 }, evening).pickupAt
    ).toMatch(/no pickup times left today/i);
  });

  it('says when the chosen pickup hour has passed', () => {
    expect(
      slotProblems({ dayOffset: 0, hour: 8 }, { dayOffset: 1, hour: 14 }, morning).pickupAt
    ).toMatch(/passed/i);
  });

  it('says when no delivery times are left that day', () => {
    expect(
      slotProblems({ dayOffset: 1, hour: 18 }, { dayOffset: 1, hour: 18 }, morning).deliverBy
    ).toMatch(/no delivery times left/i);
  });

  it('says when delivery comes before pickup', () => {
    expect(
      slotProblems({ dayOffset: 1, hour: 14 }, { dayOffset: 1, hour: 10 }, morning).deliverBy
    ).toMatch(/after pickup/i);
  });
});

describe('validateDeliveryAddress, short real places', () => {
  it('accepts a short landmark address a rider knows', () => {
    expect(validateDeliveryAddress('SM MOA')).toBeNull();
    expect(validateDeliveryAddress('Blk 5A')).toBeNull();
  });
});