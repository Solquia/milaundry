import { formatMoney, formatMoneyCompact } from '../money';

describe('formatMoney', () => {
  it('groups thousands so a counter total is readable at a glance', () => {
    // ₱2841.00 forces the owner to count digits; ₱2,841.00 does not.
    expect(formatMoney(2841)).toBe('₱2,841.00');
    expect(formatMoney(1234567.5)).toBe('₱1,234,567.50');
  });

  it('leaves amounts under a thousand unchanged', () => {
    expect(formatMoney(175)).toBe('₱175.00');
    expect(formatMoney(0)).toBe('₱0.00');
    expect(formatMoney(60.5)).toBe('₱60.50');
  });

  it('always shows centavos', () => {
    expect(formatMoney(1000)).toBe('₱1,000.00');
  });

  it('formats a negative amount without losing the group separator', () => {
    expect(formatMoney(-2841)).toBe('-₱2,841.00');
  });

  it('falls back to zero rather than rendering NaN to a customer', () => {
    expect(formatMoney(Number.NaN)).toBe('₱0.00');
  });
});

describe('formatMoneyCompact', () => {
  it('drops centavos a whole-peso price never had', () => {
    // A price list is read by scanning a column. `.00` repeated down every row
    // is four characters of weight that carry no information.
    expect(formatMoneyCompact(280)).toBe('₱280');
    expect(formatMoneyCompact(75)).toBe('₱75');
  });

  it('keeps centavos when the shop actually charges them', () => {
    expect(formatMoneyCompact(60.5)).toBe('₱60.50');
    expect(formatMoneyCompact(12.25)).toBe('₱12.25');
  });

  it('still groups thousands', () => {
    expect(formatMoneyCompact(1500)).toBe('₱1,500');
    expect(formatMoneyCompact(1500.75)).toBe('₱1,500.75');
  });

  it('handles zero and negatives the same way formatMoney does', () => {
    expect(formatMoneyCompact(0)).toBe('₱0');
    expect(formatMoneyCompact(-40)).toBe('-₱40');
  });

  it('falls back to zero rather than rendering NaN to a customer', () => {
    expect(formatMoneyCompact(Number.NaN)).toBe('₱0');
  });

  it('never disagrees with formatMoney about the amount', () => {
    // The compact form may drop `.00`, but it must never round: a ₱60.50 price
    // shown as ₱60 in the list and ₱60.50 at checkout is a broken promise.
    for (const amount of [280, 60.5, 1500.75, 0.05]) {
      expect(formatMoney(amount)).toContain(
        formatMoneyCompact(amount).replace('₱', '').split('.')[0]
      );
    }
  });
});
