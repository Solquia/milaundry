import { adjustQuantity, quantityCeiling } from '../order-quantity';

describe('quantityCeiling', () => {
  it('caps weighed services at a load no counter scale will exceed', () => {
    expect(quantityCeiling('per_kg')).toBe(100);
  });

  it('caps counted services at two digits', () => {
    expect(quantityCeiling('per_item')).toBe(99);
  });

  it('allows a flat service to be added exactly once', () => {
    expect(quantityCeiling('flat')).toBe(1);
  });
});

describe('adjustQuantity', () => {
  it('adds a step within range', () => {
    expect(adjustQuantity(2, 0.5, 100)).toBe(2.5);
  });

  it('never drops below zero', () => {
    expect(adjustQuantity(0, -1, 99)).toBe(0);
    expect(adjustQuantity(0.5, -1, 99)).toBe(0);
  });

  it('stops at the ceiling instead of counting up forever', () => {
    expect(adjustQuantity(100, 0.5, 100)).toBe(100);
    expect(adjustQuantity(99, 1, 99)).toBe(99);
  });

  it('keeps half-kilo steps clean instead of accumulating float error', () => {
    expect(adjustQuantity(2.9, 0.5, 100)).toBe(3.4);
    expect(adjustQuantity(0.1, 0.2, 100)).toBe(0.3);
  });

  it('recovers to zero from a corrupted quantity', () => {
    expect(adjustQuantity(Number.NaN, 1, 99)).toBe(1);
  });
});
