import { BUBBLY_GAV_SHOP_ID, priceGuideFor, weightLabel, type PriceGuide } from '../price-guide';

function bubblyGav(): PriceGuide {
  const guide = priceGuideFor(BUBBLY_GAV_SHOP_ID);
  if (!guide) throw new Error('Bubbly Gav has no price guide');
  return guide;
}

describe('priceGuideFor', () => {
  test('returns the custom guide for Bubbly Gav', () => {
    expect(bubblyGav().packages.map((pack) => pack.label)).toEqual([
      'Package 1',
      'Package 2',
      'Package 3',
    ]);
  });

  test('returns null for every other shop and for no shop at all', () => {
    expect(priceGuideFor('some-other-shop')).toBeNull();
    expect(priceGuideFor(null)).toBeNull();
    expect(priceGuideFor(undefined)).toBeNull();
  });
});

describe('weightLabel', () => {
  test('a band from zero reads as "up to"', () => {
    expect(weightLabel({ from: 0, to: 8 })).toBe('Up to 8 kg');
  });

  test('a single weight reads as itself', () => {
    expect(weightLabel({ from: 9, to: 9 })).toBe('9 kg');
  });

  test('a band reads as a range', () => {
    expect(weightLabel({ from: 10.5, to: 11 })).toBe('10.5 – 11 kg');
  });
});

describe('Bubbly Gav packages', () => {
  test('each package opens at its per-load price for up to 8 kg', () => {
    const opening = bubblyGav().packages.map((pack) => [pack.price, pack.weights[0]]);
    expect(opening).toEqual([
      [185, { from: 0, to: 8, loads: 1, price: 185 }],
      [210, { from: 0, to: 8, loads: 1, price: 210 }],
      [240, { from: 0, to: 8, loads: 1, price: 240 }],
    ]);
  });

  test('weight bands climb without gaps, overlaps or price drops', () => {
    for (const pack of bubblyGav().packages) {
      pack.weights.forEach((row, index) => {
        expect(row.to).toBeGreaterThanOrEqual(row.from);
        if (index === 0) return;
        const before = pack.weights[index - 1];
        expect(row.from).toBeGreaterThan(before.to);
        expect(row.price).toBeGreaterThanOrEqual(before.price);
      });
    }
  });

  test('ten kilos and over is always two loads', () => {
    for (const pack of bubblyGav().packages) {
      for (const row of pack.weights) {
        expect(row.loads).toBe(row.from >= 10 ? 2 : 1);
      }
    }
  });

  test('matches the printed price boards', () => {
    const [one, two, three] = bubblyGav().packages;
    expect(one.weights.map((row) => row.price)).toEqual([185, 200, 215, 230, 300, 315, 330]);
    expect(two.weights.map((row) => row.price)).toEqual([210, 225, 240, 255, 350, 365, 400, 435]);
    expect(three.weights.map((row) => row.price)).toEqual([240, 255, 270, 480]);
  });

  test('every package names at least one detergent and one fabcon with a photo', () => {
    for (const pack of bubblyGav().packages) {
      expect(pack.detergents.length).toBeGreaterThan(0);
      expect(pack.fabcons.length).toBeGreaterThan(0);
      for (const product of [...pack.detergents, ...pack.fabcons]) {
        expect(product.photo).toMatch(/^[a-z-]+$/);
      }
    }
  });
});

describe('Bubbly Gav other services', () => {
  test('drying packages are priced from ₱90 to ₱150', () => {
    expect(bubblyGav().drying.options.map((option) => [option.name, option.price])).toEqual([
      ['Dry only', 90],
      ['Dry + dryer sheet', 105],
      ['Spin + dry', 120],
      ['Spin + dry + dryer sheet', 135],
      ['Spin + dry + fold', 150],
    ]);
  });

  test('sneaker and cap care each have a basic and a deep clean', () => {
    expect(
      bubblyGav().restore.items.map((item) => [item.name, item.tiers.map((tier) => tier.price)])
    ).toEqual([
      ['Sneakers', [250, 400]],
      ['Caps', [150, 300]],
    ]);
  });
});
