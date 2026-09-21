import {
  MAX_PIECES,
  TICK_SPACING,
  clampPieces,
  offsetForWeight,
  parseTypedWeight,
  pieceOptions,
  rulerTicks,
  tickKind,
  weightForOffset,
} from '../quantity-input';

describe('rulerTicks', () => {
  it('covers zero through the maximum in half-kilo stops', () => {
    const ticks = rulerTicks(30, 0.5);
    expect(ticks[0]).toBe(0);
    expect(ticks[ticks.length - 1]).toBe(30);
    expect(ticks).toHaveLength(61);
  });

  it('keeps every stop free of floating-point dust', () => {
    // Naive accumulation would render "6.300000000000001 kg" on the scale.
    const ticks = rulerTicks(10, 0.5);
    expect(ticks).toContain(6.5);
    expect(ticks.every((kg) => Number.isFinite(kg) && kg === Number(kg.toFixed(1)))).toBe(
      true
    );
  });
});

describe('offsetForWeight / weightForOffset', () => {
  it('places a weight at its scroll offset and reads it back unchanged', () => {
    const offset = offsetForWeight(5, 0.5, TICK_SPACING);
    expect(offset).toBe(10 * TICK_SPACING);
    expect(weightForOffset(offset, 0.5, TICK_SPACING, 30)).toBe(5);
  });

  it('snaps a scroll that stops between two ticks to the nearer one', () => {
    const nearlyFive = 10 * TICK_SPACING - 2;
    expect(weightForOffset(nearlyFive, 0.5, TICK_SPACING, 30)).toBe(5);
  });

  it('never reads below zero when the scroll overshoots the start', () => {
    expect(weightForOffset(-120, 0.5, TICK_SPACING, 30)).toBe(0);
  });

  it('never reads past the maximum when the scroll overshoots the end', () => {
    expect(weightForOffset(99999, 0.5, TICK_SPACING, 30)).toBe(30);
  });

  it('reads a half-kilo stop as a half kilo, not a rounded whole', () => {
    expect(weightForOffset(13 * TICK_SPACING, 0.5, TICK_SPACING, 30)).toBe(6.5);
  });
});

describe('tickKind', () => {
  it('marks every fifth kilo as a labelled major tick', () => {
    expect(tickKind(0)).toBe('major');
    expect(tickKind(5)).toBe('major');
    expect(tickKind(30)).toBe('major');
  });

  it('marks whole kilos between them as minor', () => {
    expect(tickKind(3)).toBe('minor');
    expect(tickKind(12)).toBe('minor');
  });

  it('marks half kilos as the shortest tick', () => {
    expect(tickKind(3.5)).toBe('micro');
    expect(tickKind(0.5)).toBe('micro');
  });
});

describe('pieceOptions / clampPieces', () => {
  it('offers none through the maximum as tappable counts', () => {
    const options = pieceOptions();
    expect(options[0]).toBe(0);
    expect(options[options.length - 1]).toBe(MAX_PIECES);
    expect(options).toHaveLength(MAX_PIECES + 1);
  });

  it('bounds a count at both ends', () => {
    // The old "+" stepper was unbounded: 200 taps produced a ₱56,000 order.
    expect(clampPieces(-3)).toBe(0);
    expect(clampPieces(MAX_PIECES + 40)).toBe(MAX_PIECES);
  });

  it('keeps counts whole', () => {
    expect(clampPieces(2.7)).toBe(3);
    expect(clampPieces(Number.NaN)).toBe(0);
  });
});

describe('parseTypedWeight', () => {
  it('reads the figure a counter types into the scale', () => {
    expect(parseTypedWeight('2.0', 30)).toBe(2);
    expect(parseTypedWeight('2', 30)).toBe(2);
    expect(parseTypedWeight('2.5', 30)).toBe(2.5);
  });

  it('accepts the unit if they type it after the number', () => {
    expect(parseTypedWeight('2.0 kg', 30)).toBe(2);
    expect(parseTypedWeight('7.5kg', 30)).toBe(7.5);
  });

  it('treats a comma as a decimal, the way a phone keypad often does', () => {
    expect(parseTypedWeight('2,5', 30)).toBe(2.5);
  });

  it('rounds to one decimal rather than billing a dust figure', () => {
    expect(parseTypedWeight('2.37', 30)).toBe(2.4);
  });

  it('clamps a slipped extra zero to the scale instead of rejecting it', () => {
    expect(parseTypedWeight('200', 30)).toBe(30);
  });

  it('lets them type zero, so they can clear a guess', () => {
    expect(parseTypedWeight('0', 30)).toBe(0);
  });

  it('refuses anything that is not a weight, so the last reading stays', () => {
    expect(parseTypedWeight('', 30)).toBeNull();
    expect(parseTypedWeight('.', 30)).toBeNull();
    expect(parseTypedWeight('heavy', 30)).toBeNull();
  });
});
