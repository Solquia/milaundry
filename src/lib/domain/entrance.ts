/**
 * The timing of a shopfront arriving.
 *
 * Opening a laundry should feel like a machine starting, not like a page
 * loading. The choreography below is one authored moment — the field arrives,
 * the shop's mark lands on it with a ripple, the wash line sweeps across, and
 * the price list cascades in behind — rather than the same fade applied
 * separately to six things.
 *
 * The numbers live here, apart from the view, because the *order* is the design
 * decision and it is worth pinning: the field has to exist before the mark
 * lands on it, or the mark appears to fall onto nothing.
 */

export interface Cue {
  /** Milliseconds before this cue starts. */
  delay: number;
  /** Milliseconds the cue runs for. */
  duration: number;
}

/**
 * Every cue starts within a third of a second and the whole entrance is over
 * inside a second. Past that an entrance stops reading as arrival and starts
 * reading as a loading screen — the exact thing it is meant to replace.
 */
export const ENTRANCE = {
  /** The gradient settles down out of a slight overscale. */
  field: { delay: 0, duration: 520 },
  /** The mark lands, with overshoot. */
  mark: { delay: 120, duration: 460 },
  /** A ring of water leaving the mark. */
  ripple: { delay: 240, duration: 620 },
  /** The name rises. */
  name: { delay: 200, duration: 420 },
  /** Address, then the credibility line. */
  address: { delay: 260, duration: 420 },
  facts: { delay: 320, duration: 420 },
  /** The wash line: one bright sweep across the field, the splash's own motif. */
  sheen: { delay: 180, duration: 900 },
  /** The price list, behind everything else. */
  list: { delay: 340, duration: 460 },
} as const satisfies Record<string, Cue>;

/** How far apart the cards in a cascade land, and the longest anyone waits. */
export const STAGGER_STEP_MS = 70;
export const STAGGER_CAP_MS = 420;

/**
 * The extra delay for the nth item of a cascade, capped.
 *
 * The cap is the whole point. Twenty services at 70ms each would put the last
 * card 1.4 seconds in — long after the customer has started scrolling, which
 * reads as the app lagging rather than as choreography. Past the cap everything
 * remaining simply arrives together.
 */
export function staggerDelay(
  index: number,
  step = STAGGER_STEP_MS,
  cap = STAGGER_CAP_MS
): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  if (!Number.isFinite(step) || step <= 0) return 0;
  const raw = index * step;
  if (!Number.isFinite(cap)) return raw;
  return Math.min(raw, cap);
}
