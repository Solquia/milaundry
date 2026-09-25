import { extraLimit, extraPriceCaption, stepExtra } from '../heavy-items';
import type { Service } from '../pricing';

const beddings: Service = { id: 'bed', name: 'BIG BEDDINGS', unit: 'per_item', price: 123 };
const curtains: Service = { id: 'cur', name: 'Curtains', unit: 'per_kg', price: 56, min_quantity: 3 };
const steam: Service = { id: 'st', name: 'Steam', unit: 'flat', price: 90 };

describe('stepExtra', () => {
  it('adds and removes one at a time', () => {
    expect(stepExtra('per_item', 0, 1)).toBe(1);
    expect(stepExtra('per_item', 2, -1)).toBe(1);
  });

  it('never goes below zero', () => {
    expect(stepExtra('per_item', 0, -1)).toBe(0);
  });

  it('stops at the limit for the unit', () => {
    expect(stepExtra('per_item', extraLimit('per_item'), 1)).toBe(extraLimit('per_item'));
    expect(stepExtra('per_kg', extraLimit('per_kg'), 1)).toBe(extraLimit('per_kg'));
  });

  it('treats a flat extra as on or off', () => {
    expect(extraLimit('flat')).toBe(1);
    expect(stepExtra('flat', 1, 1)).toBe(1);
  });

  it('steps a half-kilo guess back onto whole kilos', () => {
    expect(stepExtra('per_kg', 2.5, 1)).toBe(3);
    expect(stepExtra('per_kg', 2.5, -1)).toBe(2);
  });
});

describe('extraPriceCaption', () => {
  it('shows the rate while nothing is added', () => {
    expect(extraPriceCaption(beddings, 0)).toBe('₱123 per piece');
  });

  it('shows what the added count costs', () => {
    expect(extraPriceCaption(beddings, 2)).toBe('₱246 for 2 pieces');
  });

  it('quotes the billed minimum, not quantity times rate', () => {
    expect(extraPriceCaption(curtains, 1)).toBe('₱168 for 1 kg');
  });

  it('names a flat price as one price', () => {
    expect(extraPriceCaption(steam, 0)).toBe('₱90 flat');
  });
});
