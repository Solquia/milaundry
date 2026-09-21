/**
 * Geometry for the two ways a customer states an amount.
 *
 * Weight is a *scale you drag* — a ruler that scrolls under a fixed centre
 * mark, because a laundry customer thinks in "about this much", not in taps.
 * Pieces are counted, so they are offered as whole numbers to hit directly.
 *
 * The maths lives here rather than in the component so the snapping, the
 * bounds, and the floating-point behaviour are testable without a renderer.
 */

/** Pixels between two adjacent half-kilo ticks. Wide enough that a whole kilo
    is a visible sweep rather than a twitch. */
export const TICK_SPACING = 18;

/** Nobody books more thick items than this at once, and the old stepper had no ceiling at all. */
export const MAX_PIECES = 12;

/** Half-kilo arithmetic accumulates dust; every stop is rounded back to one decimal. */
const roundKg = (kg: number): number => Number(kg.toFixed(1));

/** Every stop on the scale, from 0 to `maxKg`. */
export function rulerTicks(maxKg: number, stepKg: number): number[] {
  const count = Math.round(maxKg / stepKg);
  return Array.from({ length: count + 1 }, (_, index) => roundKg(index * stepKg));
}

/** Where a weight sits along the scroll, measured from the zero tick. */
export function offsetForWeight(kg: number, stepKg: number, spacing: number): number {
  return (kg / stepKg) * spacing;
}

/** The weight under the centre mark once a scroll settles, snapped and bounded. */
export function weightForOffset(
  offset: number,
  stepKg: number,
  spacing: number,
  maxKg: number
): number {
  if (!Number.isFinite(offset)) return 0;
  const steps = Math.round(offset / spacing);
  const bounded = Math.min(Math.round(maxKg / stepKg), Math.max(0, steps));
  return roundKg(bounded * stepKg);
}

export type TickKind = 'major' | 'minor' | 'micro';

/**
 * How tall a tick draws. Majors carry a number every 5 kg so the eye can find
 * its place mid-drag; minors mark whole kilos; micros are the half-kilo stops.
 */
export function tickKind(kg: number): TickKind {
  if (kg % 5 === 0) return 'major';
  if (kg % 1 === 0) return 'minor';
  return 'micro';
}

/** The counts offered as tappable tiles, none through the ceiling. */
export function pieceOptions(max: number = MAX_PIECES): number[] {
  return Array.from({ length: max + 1 }, (_, index) => index);
}

/** A whole, bounded count. */
export function clampPieces(count: number, max: number = MAX_PIECES): number {
  if (!Number.isFinite(count)) return 0;
  return Math.min(max, Math.max(0, Math.round(count)));
}

/**
 * A weight typed into the scale, not dragged.
 *
 * The ruler snaps to half kilos because a finger cannot aim finer. A keypad
 * can, so this keeps one decimal and only refuses strings that are not a
 * number — the last reading stays on screen rather than jumping to zero.
 * Anything past the scale is a slipped extra zero, not a 200 kg load.
 */
export function parseTypedWeight(raw: string, maxKg: number): number | null {
  const cleaned = raw
    .trim()
    .replace(/,/g, '.')
    .replace(/\s*kgs?\.?\s*$/i, '')
    .trim();
  if (cleaned === '' || cleaned === '.') return null;
  if (!/^\d+(\.\d*)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.min(maxKg, roundKg(value));
}
