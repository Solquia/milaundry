import {
  COVER_ASPECT,
  COVER_QUALITY,
  MAX_COVER_BYTES,
  coverTooLarge,
  heroBackdrop,
  shopLogoUri,
} from '../shop-cover';

describe('heroBackdrop', () => {
  it('shows the photo of the shop when it has one', () => {
    expect(heroBackdrop({ cover_url: 'https://cdn/shops/1/cover.jpg' })).toEqual({
      kind: 'photo',
      uri: 'https://cdn/shops/1/cover.jpg',
    });
  });

  it('falls back to the coloured field when there is no photo', () => {
    expect(heroBackdrop({ cover_url: '' })).toEqual({ kind: 'field' });
    expect(heroBackdrop({ cover_url: '   ' })).toEqual({ kind: 'field' });
    expect(heroBackdrop({ cover_url: null })).toEqual({ kind: 'field' });
    expect(heroBackdrop({})).toEqual({ kind: 'field' });
  });

  it('previews a photo the merchant just picked over the one already saved', () => {
    expect(heroBackdrop({ cover_url: 'https://cdn/old.jpg' }, 'file:///tmp/new.jpg')).toEqual({
      kind: 'photo',
      uri: 'file:///tmp/new.jpg',
    });
  });
});

describe('shopLogoUri', () => {
  it('returns the logo when there is one', () => {
    expect(shopLogoUri({ logo_url: 'https://cdn/logo.png' })).toBe('https://cdn/logo.png');
  });

  it('returns null for the empty string the database defaults to', () => {
    // '' is truthy-looking in a template but falsy in JSX guards; normalise
    // once here so every surface makes the same initials-or-image decision.
    expect(shopLogoUri({ logo_url: '' })).toBeNull();
    expect(shopLogoUri({ logo_url: '  ' })).toBeNull();
    expect(shopLogoUri({ logo_url: null })).toBeNull();
    expect(shopLogoUri({})).toBeNull();
  });
});

describe('coverTooLarge', () => {
  it('refuses a photo over the cap', () => {
    expect(coverTooLarge(MAX_COVER_BYTES + 1)).toBe(true);
  });

  it('accepts a photo at or under the cap', () => {
    expect(coverTooLarge(MAX_COVER_BYTES)).toBe(false);
    expect(coverTooLarge(1024)).toBe(false);
  });

  it('lets an unknown size through rather than blocking every pick', () => {
    // The picker does not always report fileSize; the upload will still fail
    // loudly if the bucket rejects it.
    expect(coverTooLarge(undefined)).toBe(false);
    expect(coverTooLarge(null)).toBe(false);
  });
});

describe('picker settings', () => {
  it('crops wide, because the hero is wide', () => {
    expect(COVER_ASPECT).toEqual([16, 9]);
    expect(COVER_QUALITY).toBeGreaterThan(0.5);
    expect(COVER_QUALITY).toBeLessThanOrEqual(1);
  });
});
