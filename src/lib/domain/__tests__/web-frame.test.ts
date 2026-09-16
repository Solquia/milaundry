import { FRAME_MAX_WIDTH, frameLayout } from '../web-frame';

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

  it('holds a wide browser window to a phone-width column', () => {
    expect(frameLayout({ platform: 'web', viewportWidth: 1280 })).toEqual({ isFramed: true, width: FRAME_MAX_WIDTH });
  });

  // The decision this file exists to record: a shop's public page is the
  // surface most of its customers meet on a phone, so it wears the phone
  // column on a laptop too rather than growing a desktop layout of its own.
  it('gives a shop page the same phone column as the app', () => {
    for (const pathname of ['/s/sparkle', '/s/sparkle/book', '/track/abc', '/claim/abc', '/join/abc']) {
      expect(frameLayout({ platform: 'web', viewportWidth: 1440, pathname })).toEqual({
        isFramed: true,
        width: FRAME_MAX_WIDTH,
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
