import { shopReputation, startingPrice } from '../storefront';

describe('shopReputation', () => {
  it('says nothing when nobody has reviewed the shop yet', () => {
    // A brand-new shop showing "0.0 ★" reads as a bad shop rather than a new
    // one, so the storefront must be able to leave the boast out entirely.
    expect(shopReputation([])).toBeNull();
  });

  it('averages the ratings it was given', () => {
    const reputation = shopReputation([{ rating: 5 }, { rating: 4 }]);
    expect(reputation?.average).toBe(4.5);
    expect(reputation?.count).toBe(2);
  });

  it('rounds to one decimal so the hero never shows 4.666666666666667', () => {
    expect(shopReputation([{ rating: 5 }, { rating: 5 }, { rating: 4 }])?.average).toBe(4.7);
  });

  it('drops ratings outside the 1–5 stars the review form can produce', () => {
    // Ratings arrive from the database, not from this screen. A stray 0 or 9
    // would otherwise drag the shop's public average somewhere it never earned.
    const reputation = shopReputation([
      { rating: 5 },
      { rating: 0 },
      { rating: 9 },
      { rating: Number.NaN },
    ]);
    expect(reputation?.average).toBe(5);
    expect(reputation?.count).toBe(1);
  });

  it('says nothing when every rating was unusable', () => {
    expect(shopReputation([{ rating: 0 }, { rating: -2 }])).toBeNull();
  });

  it('counts one review in the singular', () => {
    expect(shopReputation([{ rating: 4 }])?.label).toBe('4.0 · 1 review');
  });

  it('reads the way a customer would say it out loud', () => {
    expect(shopReputation([{ rating: 5 }, { rating: 4 }])?.label).toBe('4.5 · 2 reviews');
  });

  it('always shows a decimal, so 5 does not read as a different unit from 4.5', () => {
    expect(shopReputation([{ rating: 5 }])?.label).toBe('5.0 · 1 review');
  });
});

describe('startingPrice', () => {
  it('finds the cheapest way into the shop', () => {
    expect(startingPrice([{ price: 350 }, { price: 55 }, { price: 180 }])).toBe(55);
  });

  it('ignores free or nonsense prices rather than advertising ₱0', () => {
    expect(startingPrice([{ price: 0 }, { price: -5 }, { price: 60 }])).toBe(60);
  });

  it('has nothing to say about an empty price list', () => {
    expect(startingPrice([])).toBeNull();
    expect(startingPrice([{ price: 0 }])).toBeNull();
  });
});
