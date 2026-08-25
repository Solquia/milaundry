import {
  MAX_WEIGHT_KG,
  WEIGHT_STEP_KG,
  buildBookingItems,
  clampWeight,
  estimateBooking,
} from '../booking-estimate';
import type { Service } from '../pricing';

const washFold: Service = {
  id: 'wash',
  name: 'Wash, Dry & Fold',
  unit: 'per_kg',
  price: 35,
  min_quantity: 5,
};

const comforter: Service = {
  id: 'comforter',
  name: 'Comforter (thick)',
  unit: 'per_item',
  price: 280,
  min_quantity: 0,
};

const curtains: Service = {
  id: 'curtains',
  name: 'Curtains',
  unit: 'per_kg',
  price: 60,
  min_quantity: 3,
};

const catalog = [washFold, comforter, curtains];

describe('clampWeight', () => {
  it('rounds to the nearest half kilo', () => {
    expect(clampWeight(7.3)).toBe(7.5);
    expect(clampWeight(7.2)).toBe(7);
  });

  it('never goes below zero', () => {
    expect(clampWeight(-4)).toBe(0);
  });

  it('caps at the maximum bookable weight', () => {
    expect(clampWeight(MAX_WEIGHT_KG + 10)).toBe(MAX_WEIGHT_KG);
  });

  it('treats non-finite input as zero', () => {
    expect(clampWeight(Number.NaN)).toBe(0);
  });

  it('steps by half kilos', () => {
    expect(WEIGHT_STEP_KG).toBe(0.5);
  });
});

describe('buildBookingItems', () => {
  it('combines the main service weight with heavy add-on quantities', () => {
    const items = buildBookingItems('wash', 8, { comforter: 2, curtains: 0 });
    expect(items).toEqual([
      { serviceId: 'wash', quantity: 8 },
      { serviceId: 'comforter', quantity: 2 },
    ]);
  });

  it('drops the main service when weight is zero but keeps add-ons', () => {
    const items = buildBookingItems('wash', 0, { comforter: 1 });
    expect(items).toEqual([{ serviceId: 'comforter', quantity: 1 }]);
  });

  it('returns an empty list when nothing is selected', () => {
    expect(buildBookingItems('wash', 0, {})).toEqual([]);
  });
});

describe('estimateBooking', () => {
  it('prices estimated weight against the per-kg rate', () => {
    const estimate = estimateBooking(catalog, 'wash', 8, {});
    expect(estimate?.total).toBe(280); // 8 kg × ₱35
  });

  it('bills the shop minimum when the estimate is below it', () => {
    const estimate = estimateBooking(catalog, 'wash', 3, {});
    expect(estimate?.total).toBe(175); // 5 kg minimum × ₱35
  });

  it('adds heavy items on top of the base weight price', () => {
    const estimate = estimateBooking(catalog, 'wash', 8, { comforter: 1 });
    expect(estimate?.total).toBe(560); // 280 wash + 280 comforter
  });

  it('returns null when nothing is selected', () => {
    expect(estimateBooking(catalog, 'wash', 0, {})).toBeNull();
  });

  it('returns null when the service is unknown', () => {
    expect(estimateBooking(catalog, 'ghost', 5, {})).toBeNull();
  });
});
