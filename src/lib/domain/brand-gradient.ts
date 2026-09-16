/**
 * Small colour and readout arithmetic the ordering controls share.
 *
 * Two things needed deriving rather than hard-coding. A shop's page paints the
 * ruler and the counters in the shop's own accent, so every tint in them — the
 * pale plinth under the reading, the unlit ticks, the wash behind a chosen
 * tile — has to be computed from that one hex instead of being a second colour
 * somebody has to keep in step. And the figures those controls produce are
 * *rolled* rather than replaced, which needs the number split into columns.
 *
 * Pure functions, so both can be tested rather than eyeballed.
 */

/** A `#RRGGBB` string as three 0-255 channels. */
function channels(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function pair(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0');
}

/**
 * Two colours blended in RGB, `t` of the way from `a` to `b`.
 *
 * RGB rather than a perceptual space on purpose: every mix here is between a
 * colour and one of white, black, or a near neighbour of itself, where the
 * cheap blend and the careful one land in the same place.
 */
export function mixHex(a: string, b: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return `#${pair(ar + (br - ar) * clamped)}${pair(ag + (bg - ag) * clamped)}${pair(
    ab + (bb - ab) * clamped
  )}`.toUpperCase();
}

/** Toward white. `amount` 0 leaves the colour alone, 1 is white. */
export function lighten(colour: string, amount: number): string {
  return mixHex(colour, '#FFFFFF', amount);
}

/** Toward the app's deep navy rather than black: shadows here stay blue. */
export function darken(colour: string, amount: number): string {
  return mixHex(colour, '#06182B', amount);
}

/** An `rgba()` string from a `#RRGGBB` colour and an alpha. */
export function withAlpha(colour: string, alpha: number): string {
  const [r, g, b] = channels(colour);
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/**
 * How lit a ruler tick is, by how near the needle it stands.
 *
 * The ruler used to paint every tick the same two colours — majors dark,
 * everything else pale — which made the strip read as a texture with a line
 * through it. Weighting by distance puts a pool of light under the needle, so
 * the eye lands on the reading before it has read the number.
 *
 * Returns 1 directly under the needle and 0 at or beyond `reach`.
 */
export function tickEmphasis(tickValue: number, current: number, reach: number): number {
  if (reach <= 0) return tickValue === current ? 1 : 0;
  const distance = Math.abs(tickValue - current) / reach;
  if (distance >= 1) return 0;
  // Squared falloff: the pool has a bright middle rather than a flat top.
  return (1 - distance) ** 2;
}

export interface OdometerCell {
  /** The character in this column. */
  char: string;
  /** Digits roll; a decimal point or a peso sign sits still. */
  isDigit: boolean;
  /**
   * Position from the *right*, so "9.5" becoming "10.0" does not renumber the
   * columns it shares and send the whole readout spinning — only the digits
   * that actually changed move.
   */
  place: number;
}

/** A number split into the columns an odometer rolls. */
export function odometerCells(text: string): readonly OdometerCell[] {
  const chars = text.split('');
  return chars.map((char, index) => ({
    char,
    isDigit: char >= '0' && char <= '9',
    place: chars.length - 1 - index,
  }));
}
