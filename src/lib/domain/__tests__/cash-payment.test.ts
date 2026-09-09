import { changeFor, parseAmount, tenderSuggestions } from '../cash-payment';

describe('changeFor', () => {
  it('returns the change owed when the customer pays more than the total', () => {
    // Arrange
    const due = 2841;
    const tendered = 3000;

    // Act
    const result = changeFor(due, tendered);

    // Assert
    expect(result).toEqual({ change: 159, shortfall: 0, isEnough: true });
  });

  it('returns no change and no shortfall on exact payment', () => {
    expect(changeFor(175, 175)).toEqual({ change: 0, shortfall: 0, isEnough: true });
  });

  it('reports the shortfall when the customer is short', () => {
    expect(changeFor(2841, 2000)).toEqual({ change: 0, shortfall: 841, isEnough: false });
  });

  it('rounds to centavos instead of leaking float error', () => {
    // Float drift would surface at the counter as ₱0.30000000000000004.
    expect(changeFor(240.5, 500).change).toBe(259.5);
    expect(changeFor(0.3, 1).change).toBe(0.7);
  });

  it('treats a non-finite tender as no payment at all', () => {
    expect(changeFor(100, Number.NaN)).toEqual({ change: 0, shortfall: 100, isEnough: false });
  });

  it('never reports a negative shortfall on a zero total', () => {
    expect(changeFor(0, 0)).toEqual({ change: 0, shortfall: 0, isEnough: true });
  });
});

describe('parseAmount', () => {
  it('reads a plain decimal string', () => {
    expect(parseAmount('2841.50')).toBe(2841.5);
  });

  it('ignores peso signs, spaces, and thousands separators the owner may type', () => {
    expect(parseAmount('₱3,000')).toBe(3000);
    expect(parseAmount(' 1 000 ')).toBe(1000);
  });

  it('returns null for text that is not an amount', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('-50')).toBeNull();
  });
});

describe('tenderSuggestions', () => {
  it('offers the exact amount first, then realistic notes above it', () => {
    expect(tenderSuggestions(2841)).toEqual([2841, 2900, 3000]);
  });

  it('ladders small totals up through the common notes', () => {
    expect(tenderSuggestions(175)).toEqual([175, 200, 500, 1000]);
  });

  it('does not repeat the exact amount when the total is already round', () => {
    expect(tenderSuggestions(200)).toEqual([200, 500, 1000]);
  });

  it('offers nothing to tender on a zero total', () => {
    expect(tenderSuggestions(0)).toEqual([]);
  });
});
