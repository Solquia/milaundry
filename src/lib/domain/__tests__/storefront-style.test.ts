import {
  DEFAULT_STOREFRONT_STYLE,
  STOREFRONT_STYLE_OPTIONS,
  isStorefrontStyle,
  readStorefrontStyle,
} from '../storefront-style';

describe('readStorefrontStyle', () => {
  it('reads each style the shop can pick', () => {
    expect(readStorefrontStyle('classic')).toBe('classic');
    expect(readStorefrontStyle('market')).toBe('market');
  });

  it('falls back to the classic shopfront for a shop that never chose', () => {
    expect(readStorefrontStyle(undefined)).toBe(DEFAULT_STOREFRONT_STYLE);
    expect(readStorefrontStyle(null)).toBe('classic');
  });

  it('falls back rather than guessing on a value this build does not know', () => {
    expect(readStorefrontStyle('neon')).toBe('classic');
    expect(readStorefrontStyle(3)).toBe('classic');
  });
});

describe('isStorefrontStyle', () => {
  it('accepts only the known keys', () => {
    expect(isStorefrontStyle('market')).toBe(true);
    expect(isStorefrontStyle('MARKET')).toBe(false);
    expect(isStorefrontStyle('')).toBe(false);
  });
});

describe('STOREFRONT_STYLE_OPTIONS', () => {
  it('offers every style once, classic first', () => {
    expect(STOREFRONT_STYLE_OPTIONS.map((option) => option.key)).toEqual(['classic', 'market']);
  });

  it('describes each one in words an owner can choose by', () => {
    for (const option of STOREFRONT_STYLE_OPTIONS) {
      expect(option.title.length).toBeGreaterThan(0);
      expect(option.detail.length).toBeGreaterThan(0);
      expect(option.points.length).toBeGreaterThan(0);
    }
  });
});
