import { arrivedPayments } from '../live-payments';

const payment = (id: string) => ({ id, amount: 100, method: 'cash' as const, name: 'A', paidAt: '' });

describe('payments arriving while the screen is open', () => {
  it('stays quiet on the first look so opening the screen is not a flood', () => {
    expect(arrivedPayments(null, [payment('a')])).toEqual([]);
  });

  it('announces only the payments that were not there before', () => {
    const seen = new Set(['a']);
    expect(arrivedPayments(seen, [payment('b'), payment('a')]).map((p) => p.id)).toEqual(['b']);
  });
});
