import { FRAME_MAX_WIDTH, frameLayout, hasOwnWebLayout } from '../web-frame';

describe('hasOwnWebLayout', () => {
  it('lets a shop page, a tracking page, a claim and a join out of the column', () => {
    for (const pathname of ['/s/sparkle', '/s/sparkle/book', '/track/abc', '/claim/abc', '/join/abc']) {
      expect(hasOwnWebLayout(pathname)).toBe(true);
    }
  });

  it('leaves the app in the column', () => {
    for (const pathname of ['/', '/shops', '/settings', '/splash', '/download']) {
      expect(hasOwnWebLayout(pathname)).toBe(false);
    }
  });

  it('does not match near-misses of the public prefixes', () => {
    for (const pathname of ['/settings/shops', '/tracking', '/joined', '/s', '/track']) {
      expect(hasOwnWebLayout(pathname)).toBe(false);
    }
  });

  it('treats a missing path as the app', () => {
    expect(hasOwnWebLayout(null)).toBe(false);
    expect(hasOwnWebLayout(undefined)).toBe(false);
    expect(hasOwnWebLayout('')).toBe(false);
  });
});

describe('frameLayout', () => {
  it('lets a phone fill its screen', () => {
    expect(frameLayout({ platform: 'ios', viewportWidth: 390 })).toEqual({ isFramed: false, width: 390 });
    expect(frameLayout({ platform: 'android', viewportWidth: 1280 })).toEqual({ isFramed: false, width: 1280 });
  });

  it('fills a narrow browser window like a phone', () => {
    expect(frameLayout({ platform: 'web', viewportWidth: 400 })).toEqual({ isFramed: false, width: 400 });
    expect(frameLayout({ platform: 'web', viewportWidth: FRAME_MAX_WIDTH })).toEqual({
      isFramed: false,
      width: FRAME_MAX_WIDTH,
    });
  });

  it('holds the app to a phone-width column in a wide browser window', () => {
    expect(frameLayout({ platform: 'web', viewportWidth: 1280 })).toEqual({ isFramed: true, width: FRAME_MAX_WIDTH });
    expect(frameLayout({ platform: 'web', viewportWidth: 1440, pathname: '/shops' })).toEqual({
      isFramed: true,
      width: FRAME_MAX_WIDTH,
    });
  });

  it('lets a shop page use the window it was opened in', () => {
    for (const pathname of ['/s/sparkle', '/s/sparkle/book', '/track/abc', '/claim/abc', '/join/abc']) {
      expect(frameLayout({ platform: 'web', viewportWidth: 1440, pathname })).toEqual({
        isFramed: false,
        width: 1440,
      });
      expect(frameLayout({ platform: 'web', viewportWidth: 768, pathname })).toEqual({
        isFramed: false,
        width: 768,
      });
    }
  });

  it('measures the column against a real phone, not a tablet', () => {
    expect(FRAME_MAX_WIDTH).toBeGreaterThanOrEqual(390);
    expect(FRAME_MAX_WIDTH).toBeLessThanOrEqual(440);
  });

  it('treats an unmeasured window as narrow rather than framing on nothing', () => {
    expect(frameLayout({ platform: 'web', viewportWidth: 0 })).toEqual({ isFramed: false, width: 0 });
    expect(frameLayout({ platform: 'web', viewportWidth: Number.NaN }).isFramed).toBe(false);
  });
});
