import {
  loadFloor,
  loadLevel,
  loadSizeFor,
  loadSizes,
  loadSummary,
  overLoadNotice,
} from '../load-size';
import type { Service } from '../pricing';

const washFold = (min: number): Service => ({
  id: 'wf',
  name: 'Wash & Fold',
  unit: 'per_kg',
  price: 25,
  min_quantity: min,
});

describe('loadFloor', () => {
  test('is the shop minimum when it is above the booking floor', () => {
    expect(loadFloor(washFold(8))).toBe(8);
  });

  test('falls back to the booking floor when the shop sets no minimum', () => {
    expect(loadFloor(washFold(0))).toBe(1);
  });
});

describe('loadSizes', () => {
  test('offers four sizes starting at the everyday bag when there is no minimum', () => {
    const sizes = loadSizes(washFold(0));
    expect(sizes.map((size) => size.kg)).toEqual([3, 5, 8, 12]);
  });

  test('never offers a size below the shop minimum', () => {
    const sizes = loadSizes(washFold(8));
    expect(sizes.every((size) => size.kg >= 8)).toBe(true);
    expect(sizes[0].kg).toBe(8);
    expect(sizes).toHaveLength(4);
  });

  test('marks the smallest size as covered by the minimum charge', () => {
    const sizes = loadSizes(washFold(8));
    expect(sizes[0].isMinimum).toBe(true);
    expect(sizes.slice(1).some((size) => size.isMinimum)).toBe(false);
  });

  test('adds the minimum itself when no standard size lands on it', () => {
    const sizes = loadSizes(washFold(6));
    expect(sizes[0]).toMatchObject({ kg: 6, isMinimum: true });
    expect(sizes.map((size) => size.kg)).toEqual([6, 8, 12, 18]);
  });

  test('gives each size an increasing basket count for its art', () => {
    const counts = loadSizes(washFold(0)).map((size) => size.baskets);
    expect([...counts].sort((a, b) => a - b)).toEqual(counts);
  });
});

describe('loadSizeFor', () => {
  test('finds the size a weight matches', () => {
    expect(loadSizeFor(loadSizes(washFold(0)), 5)?.label).toBe('One basket');
  });

  test('is null for an exact weight between sizes', () => {
    expect(loadSizeFor(loadSizes(washFold(0)), 6.5)).toBeNull();
  });
});

describe('loadSummary', () => {
  test('names the size and its weight', () => {
    expect(loadSummary(loadSizes(washFold(0)), 5)).toBe('One basket · up to 5 kg');
  });

  test('reads an exact weight as just the weight', () => {
    expect(loadSummary(loadSizes(washFold(0)), 6.5)).toBe('6.5 kg, weighed at home');
  });
});

describe('loadLevel', () => {
  test('rises with the weight and stays inside the glass', () => {
    const sizes = loadSizes(washFold(0));
    const small = loadLevel(sizes, 3);
    const big = loadLevel(sizes, 12);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThanOrEqual(0.2);
    expect(loadLevel(sizes, 30)).toBeLessThanOrEqual(0.85);
  });
});

describe('overLoadNotice', () => {
  const perLoad: Service = { id: 'wdf', name: 'Wash-Dry-Fold', unit: 'flat', price: 150, max_quantity: 6 };

  test('says nothing within one load', () => {
    expect(overLoadNotice(perLoad, 6)).toBeNull();
  });

  test('warns when the weight is more than one load', () => {
    expect(overLoadNotice(perLoad, 9)).toMatch(/6 kg/);
  });

  test('says nothing for a per-kilo service or one with no load limit', () => {
    expect(overLoadNotice({ ...washFold(0), max_quantity: 6 }, 9)).toBeNull();
    expect(overLoadNotice({ ...perLoad, max_quantity: 0 }, 9)).toBeNull();
  });
});