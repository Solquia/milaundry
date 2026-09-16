import {
  darken,
  lighten,
  mixHex,
  odometerCells,
  tickEmphasis,
  withAlpha,
} from '../brand-gradient';

const channels = (colour: string) =>
  colour
    .replace('#', '')
    .match(/../g)!
    .map((pair) => parseInt(pair, 16));

describe('mixHex', () => {
  it('returns the first colour at t=0 and the second at t=1', () => {
    expect(mixHex('#208AEF', '#FFFFFF', 0)).toBe('#208AEF');
    expect(mixHex('#208AEF', '#FFFFFF', 1)).toBe('#FFFFFF');
  });

  it('lands halfway between two colours at t=0.5', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });

  it('clamps a t outside 0..1 rather than running off the ramp', () => {
    expect(mixHex('#000000', '#FFFFFF', 4)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#FFFFFF', -4)).toBe('#000000');
  });

  it('accepts a three-digit hex', () => {
    expect(mixHex('#08F', '#08F', 0.5)).toBe('#0088FF');
  });
});

describe('lighten and darken', () => {
  it('move the colour in opposite directions', () => {
    const brand = '#1370CE';
    const [, , lightBlue] = channels(lighten(brand, 0.3));
    const [, , darkBlue] = channels(darken(brand, 0.3));
    expect(lightBlue).toBeGreaterThan(darkBlue);
  });

  it('keeps a shadow blue rather than dropping it to grey', () => {
    const [red, , blue] = channels(darken('#1370CE', 0.5));
    expect(blue).toBeGreaterThan(red);
  });
});

describe('withAlpha', () => {
  it('carries the channels through and clamps the alpha', () => {
    expect(withAlpha('#1370CE', 0.4)).toBe('rgba(19, 112, 206, 0.4)');
    expect(withAlpha('#1370CE', 9)).toBe('rgba(19, 112, 206, 1)');
  });
});

describe('tickEmphasis', () => {
  it('is fully lit directly under the needle', () => {
    expect(tickEmphasis(5, 5, 4)).toBe(1);
  });

  it('falls to nothing at the edge of its reach and beyond', () => {
    expect(tickEmphasis(9, 5, 4)).toBe(0);
    expect(tickEmphasis(40, 5, 4)).toBe(0);
  });

  it('falls away with distance rather than stepping', () => {
    const near = tickEmphasis(6, 5, 4);
    const far = tickEmphasis(8, 5, 4);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeGreaterThan(0);
  });

  it('lights only an exact match when there is no reach', () => {
    expect(tickEmphasis(5, 5, 0)).toBe(1);
    expect(tickEmphasis(6, 5, 0)).toBe(0);
  });
});

describe('odometerCells', () => {
  it('marks which columns roll and which sit still', () => {
    expect(odometerCells('2.0')).toEqual([
      { char: '2', isDigit: true, place: 2 },
      { char: '.', isDigit: false, place: 1 },
      { char: '0', isDigit: true, place: 0 },
    ]);
  });

  it('numbers columns from the right, so a carry does not renumber them', () => {
    const tenths = (text: string) => odometerCells(text).find((cell) => cell.place === 0);
    expect(tenths('9.5')?.char).toBe('5');
    expect(tenths('10.0')?.char).toBe('0');
  });
});
