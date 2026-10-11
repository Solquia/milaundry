import {
  priceForWeight,
  readWeightPrices,
  validateWeightPriceDraft,
  weightBands,
  type WeightPrice,
} from '../weight-prices';

const PACKAGE_ONE: WeightPrice[] = [
  { up_to_kg: 8, price: 185 },
  { up_to_kg: 8.5, price: 200 },
  { up_to_kg: 9.5, price: 230 },
  { up_to_kg: 11, price: 330 },
];

describe('priceForWeight', () => {
  test('a load inside the first row costs the first row', () => {
    expect(priceForWeight(PACKAGE_ONE, 3)).toBe(185);
    expect(priceForWeight(PACKAGE_ONE, 8)).toBe(185);
  });

  test('a load just over a row moves to the next one', () => {
    expect(priceForWeight(PACKAGE_ONE, 8.1)).toBe(200);
    expect(priceForWeight(PACKAGE_ONE, 9)).toBe(230);
  });

  test('a load past the last row costs the last row', () => {
    expect(priceForWeight(PACKAGE_ONE, 15)).toBe(330);
  });

  test('reads rows in weight order whatever order they were saved in', () => {
    expect(priceForWeight([...PACKAGE_ONE].reverse(), 8.5)).toBe(200);
  });

  test('no table means no weight price', () => {
    expect(priceForWeight([], 9)).toBeNull();
  });
});

describe('readWeightPrices', () => {
  test('keeps well-formed rows, reading numbers sent as text', () => {
    expect(readWeightPrices([{ up_to_kg: '8', price: '185.00' }])).toEqual([{ up_to_kg: 8, price: 185 }]);
  });

  test('drops anything that is not a usable row', () => {
    expect(readWeightPrices(null)).toEqual([]);
    expect(readWeightPrices('8:185')).toEqual([]);
    expect(readWeightPrices([{ up_to_kg: 0, price: 10 }, { up_to_kg: 8 }, { up_to_kg: 9, price: -1 }])).toEqual([]);
  });
});

describe('weightBands', () => {
  test('each row reads from just over the row before it', () => {
    expect(weightBands(PACKAGE_ONE.slice(0, 3))).toEqual([
      { from: 0, to: 8, price: 185 },
      { from: 8.5, to: 8.5, price: 200 },
      { from: 9, to: 9.5, price: 230 },
    ]);
  });
});

describe('validateWeightPriceDraft', () => {
  test('accepts rows typed as text and sorts them', () => {
    expect(
      validateWeightPriceDraft([
        { upTo: '9', price: '215' },
        { upTo: '8', price: '185' },
      ])
    ).toEqual({ ok: true, value: [{ up_to_kg: 8, price: 185 }, { up_to_kg: 9, price: 215 }] });
  });

  test('ignores a fully blank row', () => {
    expect(validateWeightPriceDraft([{ upTo: '', price: '' }])).toEqual({ ok: true, value: [] });
  });

  test('refuses a half-filled row, a bad number and a repeated weight', () => {
    expect(validateWeightPriceDraft([{ upTo: '8', price: '' }]).ok).toBe(false);
    expect(validateWeightPriceDraft([{ upTo: 'eight', price: '185' }]).ok).toBe(false);
    expect(
      validateWeightPriceDraft([
        { upTo: '8', price: '185' },
        { upTo: '8', price: '200' },
      ]).ok
    ).toBe(false);
  });
});
