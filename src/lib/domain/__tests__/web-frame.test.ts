import { FRAME_MAX_WIDTH, frameLayout, hasOwnWebLayout } from '../web-frame';

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

  it('keeps the column a phone size, not a tablet', () => {
    expect(FRAME_MAX_WIDTH).toBeGreaterThanOrEqual(420);
    expect(FRAME_MAX_WIDTH).toBeLessThanOrEqual(520);
  });
});

describe('hasOwnWebLayout', () => {
  it('knows the public pages that lay themselves out', () => {
    expect(hasOwnWebLayout('/s/sparkle')).toBe(true);
    expect(hasOwnWebLayout('/s/sparkle/book')).toBe(true);
    expect(hasOwnWebLayout('/s/sparkle/orders')).toBe(true);
    expect(hasOwnWebLayout('/track/abc-123')).toBe(true);
    expect(hasOwnWebLayout('/claim/abc-123')).toBe(true);
    expect(hasOwnWebLayout('/join/abc-123')).toBe(true);
  });

  it('leaves the app screens framed', () => {
    expect(hasOwnWebLayout('/')).toBe(false);
    expect(hasOwnWebLayout('/(customer)/shops')).toBe(false);
    expect(hasOwnWebLayout('/settings')).toBe(false);
    expect(hasOwnWebLayout('/scan')).toBe(false);
    expect(hasOwnWebLayout(null)).toBe(false);
    expect(hasOwnWebLayout(undefined)).toBe(false);
  });

  it('does not mistake a route that merely starts with the same letters', () => {
    expect(hasOwnWebLayout('/settings/shops')).toBe(false);
    expect(hasOwnWebLayout('/tracking')).toBe(false);
    expect(hasOwnWebLayout('/joined')).toBe(false);
  });
});

describe('frameLayout on a page with its own layout', () => {
  it('gives a shop page the whole window, however wide', () => {
    expect(frameLayout({ platform: 'web', viewportWidth: 1440, pathname: '/s/sparkle' })).toEqual({
      isFramed: false,
      width: 1440,
    });
    expect(
      frameLayout({ platform: 'web', viewportWidth: 1920, pathname: '/s/sparkle/book' })
    ).toEqual({ isFramed: false, width: 1920 });
  });

  it('still frames the app around it', () => {
    expect(frameLayout({ platform: 'web', viewportWidth: 1440, pathname: '/(customer)/shops' })).toEqual({
      isFramed: true,
      width: FRAME_MAX_WIDTH,
    });
  });
});
