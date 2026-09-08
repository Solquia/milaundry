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

  it('keeps the column a phone size, not a tablet', () => {
    expect(FRAME_MAX_WIDTH).toBeGreaterThanOrEqual(420);
    expect(FRAME_MAX_WIDTH).toBeLessThanOrEqual(520);
  });
});
