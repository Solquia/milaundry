import {
  BREAKPOINTS,
  breakpointFor,
  gridRows,
  mainWidth,
  webLayout,
} from '../web-layout';

describe('breakpointFor', () => {
  it('names each size by the window it is opened in', () => {
    expect(breakpointFor(390)).toBe('phone');
    expect(breakpointFor(699)).toBe('phone');
    expect(breakpointFor(BREAKPOINTS.tablet)).toBe('tablet');
    expect(breakpointFor(1023)).toBe('tablet');
    expect(breakpointFor(BREAKPOINTS.laptop)).toBe('laptop');
    expect(breakpointFor(1439)).toBe('laptop');
    expect(breakpointFor(BREAKPOINTS.desktop)).toBe('desktop');
    expect(breakpointFor(2560)).toBe('desktop');
  });

  it('falls back to the phone layout before the window has been measured', () => {
    expect(breakpointFor(0)).toBe('phone');
    expect(breakpointFor(Number.NaN)).toBe('phone');
    expect(breakpointFor(-1)).toBe('phone');
  });
});

describe('webLayout', () => {
  it('gives a phone its whole viewport', () => {
    expect(webLayout(390).contentWidth).toBe(390);
    expect(webLayout(320).contentWidth).toBe(320);
  });

  it('never asks a phone to carry a second column', () => {
    const layout = webLayout(390);
    expect(layout.hasAside).toBe(false);
    expect(layout.asideWidth).toBe(0);
    expect(mainWidth(layout)).toBe(390);
  });

  it('stands an aside beside the main column once there is room', () => {
    expect(webLayout(800).hasAside).toBe(false);
    expect(webLayout(1280).hasAside).toBe(true);
    expect(webLayout(1920).hasAside).toBe(true);
  });

  it('stops the content growing so a line of text stays readable', () => {
    expect(webLayout(1920).contentWidth).toBe(webLayout(3840).contentWidth);
    expect(webLayout(3840).contentWidth).toBeLessThanOrEqual(1400);
  });

  it('never lets the content overflow the window it is drawn in', () => {
    for (const width of [320, 390, 700, 834, 1024, 1280, 1440, 1920]) {
      expect(webLayout(width).contentWidth).toBeLessThanOrEqual(width);
    }
  });

  it('fits more price cards across a wider window, and never fewer', () => {
    const counts = [390, 834, 1280, 1920].map((width) => webLayout(width).priceColumns);
    expect(counts).toEqual([...counts].sort((a, b) => a - b));
    expect(counts[0]).toBe(2);
    expect(counts[counts.length - 1]).toBeGreaterThan(2);
  });

  it('grows the hero and the gutter with the window', () => {
    const heights = [390, 834, 1280, 1920].map((width) => webLayout(width).heroHeight);
    const gutters = [390, 834, 1280, 1920].map((width) => webLayout(width).gutter);
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
    expect(gutters).toEqual([...gutters].sort((a, b) => a - b));
  });

  it('leaves the main column the wider of the two', () => {
    for (const width of [1280, 1920]) {
      const layout = webLayout(width);
      expect(mainWidth(layout)).toBeGreaterThan(layout.asideWidth);
    }
  });
});

describe('gridRows', () => {
  it('deals items into rows of the width asked for', () => {
    expect(gridRows([1, 2, 3, 4], 2)).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(gridRows([1, 2, 3, 4, 5, 6], 3)).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
  });

  it('pads a short last row so its cards keep their width', () => {
    expect(gridRows([1, 2, 3], 2)).toEqual([
      [1, 2],
      [3, null],
    ]);
    expect(gridRows([1], 4)).toEqual([[1, null, null, null]]);
  });

  it('has nothing to draw for nothing', () => {
    expect(gridRows([], 3)).toEqual([]);
  });

  it('survives a nonsense column count rather than looping forever', () => {
    expect(gridRows([1, 2], 0)).toEqual([[1], [2]]);
    expect(gridRows([1, 2], -3)).toEqual([[1], [2]]);
  });
});
