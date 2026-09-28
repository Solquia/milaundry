import {
  MIN_BOOKING_WEIGHT_KG,
  validateBookingLoad,
  validateDeliveryAddress,
} from '../booking-validation';

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

describe('validateDeliveryAddress, short real places', () => {
  it('accepts a short landmark address a rider knows', () => {
    expect(validateDeliveryAddress('SM MOA')).toBeNull();
    expect(validateDeliveryAddress('Blk 5A')).toBeNull();
  });
});
describe('validateBookingLoad, a flat price sold per load', () => {
  const perLoad = { id: 's-wdf', unit: 'flat' as const, max_quantity: 6 };

  it('asks for a weight, not items', () => {
    expect(
      validateBookingLoad({ service: perLoad, quantity: 0, addOns: {}, catalog: [perLoad] })
    ).toMatch(/how heavy/i);
  });

  it('refuses a load under the minimum weight', () => {
    expect(
      validateBookingLoad({ service: perLoad, quantity: 0.5, addOns: {}, catalog: [perLoad] })
    ).toMatch(/smallest load/i);
  });
});