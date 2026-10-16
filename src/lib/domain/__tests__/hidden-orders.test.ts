import {
  MAX_HIDDEN_ORDERS,
  canHideOrder,
  hideOrderPrompt,
  parseHiddenOrderIds,
  withHidden,
  withoutHidden,
} from '../hidden-orders';

describe('canHideOrder', () => {
  it('lets finished, cancelled and ready-at-the-counter loads go', () => {
    expect(canHideOrder('completed')).toBe(true);
    expect(canHideOrder('cancelled')).toBe(true);
    expect(canHideOrder('ready')).toBe(true);
  });

  it('keeps a load the shop is still working on', () => {
    for (const status of ['pending', 'received', 'sorting', 'washing', 'drying', 'folded'] as const) {
      expect(canHideOrder(status)).toBe(false);
    }
  });
});

describe('parseHiddenOrderIds', () => {
  it('is empty for nothing stored', () => {
    expect(parseHiddenOrderIds(null)).toEqual([]);
  });

  it('is empty for junk rather than throwing', () => {
    expect(parseHiddenOrderIds('{not json')).toEqual([]);
    expect(parseHiddenOrderIds('{"a":1}')).toEqual([]);
  });

  it('keeps only non-empty strings', () => {
    expect(parseHiddenOrderIds(JSON.stringify(['a', 3, '', null, 'b']))).toEqual(['a', 'b']);
  });
});

describe('withHidden', () => {
  it('adds new ids without repeating old ones', () => {
    expect(withHidden(['a'], ['a', 'b', 'b'])).toEqual(['a', 'b']);
  });

  it('does not change the list it was given', () => {
    const current = ['a'];
    withHidden(current, ['b']);
    expect(current).toEqual(['a']);
  });

  it('drops the oldest once over the cap', () => {
    const full = Array.from({ length: MAX_HIDDEN_ORDERS }, (_, i) => `o${i}`);
    const next = withHidden(full, ['new']);
    expect(next).toHaveLength(MAX_HIDDEN_ORDERS);
    expect(next[0]).toBe('o1');
    expect(next[next.length - 1]).toBe('new');
  });
});

describe('withoutHidden', () => {
  it('brings orders back', () => {
    expect(withoutHidden(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c']);
  });
});

describe('hideOrderPrompt', () => {
  it('names one order or many', () => {
    expect(hideOrderPrompt(1).title).toBe('Remove from home?');
    expect(hideOrderPrompt(4).title).toBe('Remove 4 orders from home?');
    expect(hideOrderPrompt(4).confirmLabel).toBe('Remove');
  });
});
