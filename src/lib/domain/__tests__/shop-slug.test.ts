import { slugifyShopName, uniqueSlug } from '../shop-slug';

describe('slugifyShopName', () => {
  it('lowercases and hyphenates the shop name', () => {
    expect(slugifyShopName('Sparkle Wash')).toBe('sparkle-wash');
  });

  it('strips punctuation and collapses separators', () => {
    expect(slugifyShopName("Maria's  Laundry & Dry-Clean!")).toBe(
      'marias-laundry-dry-clean'
    );
  });

  it('trims leading and trailing separators', () => {
    expect(slugifyShopName('  --Wash Day--  ')).toBe('wash-day');
  });

  it('caps the slug at 40 characters without a dangling hyphen', () => {
    const slug = slugifyShopName('A'.repeat(30) + ' ' + 'B'.repeat(30));
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('returns an empty string when nothing usable remains', () => {
    expect(slugifyShopName('!!!')).toBe('');
    expect(slugifyShopName('')).toBe('');
  });
});

describe('uniqueSlug', () => {
  it('keeps the base slug when free', () => {
    expect(uniqueSlug('sparkle-wash', [])).toBe('sparkle-wash');
  });

  it('appends the first free numeric suffix', () => {
    expect(uniqueSlug('sparkle-wash', ['sparkle-wash'])).toBe('sparkle-wash-2');
    expect(uniqueSlug('sparkle-wash', ['sparkle-wash', 'sparkle-wash-2'])).toBe(
      'sparkle-wash-3'
    );
  });
});
