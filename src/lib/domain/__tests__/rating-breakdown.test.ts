import { ratingBreakdown } from '../storefront';

describe('ratingBreakdown', () => {
  it('reads five rows, best first, whatever the data holds', () => {
    const rows = ratingBreakdown([{ rating: 5 }, { rating: 5 }, { rating: 3 }]);
    expect(rows.map((row) => row.stars)).toEqual([5, 4, 3, 2, 1]);
  });

  it('counts each band and measures it against the busiest one', () => {
    const rows = ratingBreakdown([{ rating: 5 }, { rating: 5 }, { rating: 5 }, { rating: 4 }]);
    const five = rows[0];
    const four = rows[1];
    const one = rows[4];
    expect(five.count).toBe(3);
    expect(five.share).toBe(1);
    expect(four.count).toBe(1);
    expect(four.share).toBeCloseTo(1 / 3, 6);
    expect(one.count).toBe(0);
    expect(one.share).toBe(0);
  });

  it('ignores ratings the review form could never have produced', () => {
    const rows = ratingBreakdown([{ rating: 0 }, { rating: 9 }, { rating: Number.NaN }, { rating: 2 }]);
    expect(rows.reduce((sum, row) => sum + row.count, 0)).toBe(1);
    expect(rows[3].count).toBe(1);
  });

  it('reads five empty rows for a shop nobody has rated', () => {
    const rows = ratingBreakdown([]);
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.count === 0 && row.share === 0)).toBe(true);
  });
});
