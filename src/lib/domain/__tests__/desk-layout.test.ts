import {
  DESK_MAX_CONTENT_WIDTH,
  DESK_MIN_WIDTH,
  DESK_READING_WIDTH,
  SIDEBAR_WIDTH,
  chunkRows,
  deskColumns,
  deskLayout,
  deskSceneWidth,
  isDeskWidth,
} from '../desk-layout';

describe('isDeskWidth', () => {
  it('gives a laptop browser the desk', () => {
    expect(isDeskWidth('web', 1280)).toBe(true);
    expect(isDeskWidth('web', DESK_MIN_WIDTH)).toBe(true);
  });

  it('keeps a tablet, a phone and every native screen on the phone layout', () => {
    expect(isDeskWidth('web', DESK_MIN_WIDTH - 1)).toBe(false);
    expect(isDeskWidth('web', 390)).toBe(false);
    expect(isDeskWidth('ios', 1366)).toBe(false);
    expect(isDeskWidth('android', 1280)).toBe(false);
  });

  it('treats an unmeasured window as narrow', () => {
    expect(isDeskWidth('web', 0)).toBe(false);
    expect(isDeskWidth('web', Number.NaN)).toBe(false);
  });
});

describe('deskLayout', () => {
  it('leaves the window alone off the desk', () => {
    expect(deskLayout('web', 800)).toEqual({ isDesk: false, contentWidth: 800 });
  });

  it('gives the working area what the sidebar leaves', () => {
    expect(deskLayout('web', 1280)).toEqual({ isDesk: true, contentWidth: 1280 - SIDEBAR_WIDTH });
  });

  it('caps the working area on a large monitor', () => {
    expect(deskLayout('web', 2560).contentWidth).toBe(DESK_MAX_CONTENT_WIDTH);
  });
});

describe('deskSceneWidth', () => {
  it('lets the screens drawn for the desk take the working area', () => {
    for (const name of ['orders', 'pos', 'customers', 'analytics']) {
      expect(deskSceneWidth(name, 1200)).toBe(1200);
    }
  });

  it('keeps forms and settings to a readable width', () => {
    expect(deskSceneWidth('settings', 1200)).toBe(DESK_READING_WIDTH);
    expect(deskSceneWidth('order/[id]', 1200)).toBe(DESK_READING_WIDTH);
    expect(deskSceneWidth('settings', 600)).toBe(600);
  });
});

describe('deskColumns', () => {
  it('gives a phone one column', () => {
    expect(deskColumns(390)).toBe(1);
    expect(deskColumns(430)).toBe(1);
  });

  it('stands cards side by side on a laptop, up to the cap', () => {
    expect(deskColumns(800)).toBe(2);
    expect(deskColumns(1200)).toBe(3);
    expect(deskColumns(2400)).toBe(3);
    expect(deskColumns(1200, 270, 4)).toBe(4);
  });

  it('never returns fewer than one column', () => {
    expect(deskColumns(0)).toBe(1);
    expect(deskColumns(Number.NaN)).toBe(1);
    expect(deskColumns(100)).toBe(1);
  });
});

describe('chunkRows', () => {
  it('cuts a list into rows in reading order', () => {
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkRows([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
  });

  it('returns no rows for no items', () => {
    expect(chunkRows([], 3)).toEqual([]);
  });

  it('falls back to one item a row on a bad column count', () => {
    expect(chunkRows([1, 2], 0)).toEqual([[1], [2]]);
    expect(chunkRows([1, 2], Number.NaN)).toEqual([[1], [2]]);
  });
});
