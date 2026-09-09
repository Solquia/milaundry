import { accentIndex, assignAccents } from '../accent';

describe('accentIndex', () => {
  it('gives the same shop the same accent every time', () => {
    // A shop's colour is part of how a customer recognises it in the list, so
    // it must survive a reload, a re-sort, and a reinstall.
    expect(accentIndex('shop-sparkle-wash', 6)).toBe(accentIndex('shop-sparkle-wash', 6));
  });

  it('always lands inside the palette', () => {
    const seeds = ['a', 'zzz', '', '9f8e-4c2b', 'Aling Nena Laundry', '🧺'];
    for (const seed of seeds) {
      const index = accentIndex(seed, 6);
      expect(Number.isInteger(index)).toBe(true);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(6);
    }
  });

  it('falls back to the first accent for an unusable palette size', () => {
    expect(accentIndex('anything', 1)).toBe(0);
    expect(accentIndex('anything', 0)).toBe(0);
    expect(accentIndex('anything', -3)).toBe(0);
  });
});

describe('assignAccents', () => {
  it('never gives two shops on screen the same accent', () => {
    // These two collide on a raw hash — with six colours any pair collides one
    // time in six — so the list, not the hash, has to guarantee distinctness.
    const [first, second] = assignAccents(['sparkle-wash', 'sparkle-clean'], 6);
    expect(first).not.toBe(second);
  });

  it('keeps every accent distinct across a full palette', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(new Set(assignAccents(seeds, 6)).size).toBe(6);
  });

  it('leaves an existing shop its colour when a new one is added after it', () => {
    const before = assignAccents(['sparkle-wash'], 6);
    const after = assignAccents(['sparkle-wash', 'bubbles-laundry'], 6);
    expect(after[0]).toBe(before[0]);
  });

  it('honours the preferred accent when nothing has taken it', () => {
    expect(assignAccents(['sparkle-wash'], 6)[0]).toBe(accentIndex('sparkle-wash', 6));
  });

  it('keeps going once the palette is exhausted', () => {
    const seeds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const assigned = assignAccents(seeds, 6);
    expect(assigned).toHaveLength(8);
    expect(assigned.every((index) => index >= 0 && index < 6)).toBe(true);
  });

  it('survives an unusable palette size without throwing', () => {
    expect(assignAccents(['a', 'b'], 0)).toEqual([0, 0]);
  });

  it('returns nothing for an empty list', () => {
    expect(assignAccents([], 6)).toEqual([]);
  });
});
