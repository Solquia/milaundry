/**
 * Cash arithmetic for the counter.
 *
 * Most laundry payments in a neighbourhood shop are notes handed across a
 * counter, so the owner is doing subtraction in their head next to a phone
 * that already knows the total. These helpers move that arithmetic into the
 * app: what change is owed, whether the customer is short, and which notes
 * they most likely handed over.
 */

import { roundCentavos } from './money';

/** Notes people actually pay with, cheapest ladder first. */
const TENDER_LADDER = [100, 500, 1000] as const;

export interface CashChange {
  /** Owed back to the customer. Zero when the tender does not cover the bill. */
  change: number;
  /** Still owed by the customer. Zero once the tender covers the bill. */
  shortfall: number;
  isEnough: boolean;
}

/**
 * What to hand back. A tender that is missing, negative, or not a number is
 * treated as no payment rather than as a discount.
 */
export function changeFor(due: number, tendered: number): CashChange {
  const owed = Number.isFinite(due) && due > 0 ? due : 0;
  const paid = Number.isFinite(tendered) && tendered > 0 ? tendered : 0;
  const delta = roundCentavos(paid - owed);

  if (delta >= 0) return { change: delta, shortfall: 0, isEnough: true };
  return { change: 0, shortfall: roundCentavos(-delta), isEnough: false };
}

/**
 * Read an amount the owner typed. Tolerates the peso sign, spaces, and
 * thousands separators, because those are what the field shows back to them.
 * Returns null for anything that is not a positive amount, so the caller can
 * say so instead of silently treating it as zero.
 */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[₱,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/**
 * One-tap tender amounts: the exact bill first (regulars pay exact), then the
 * next realistic note up. Nothing to suggest on a zero bill.
 */
export function tenderSuggestions(due: number): number[] {
  if (!Number.isFinite(due) || due <= 0) return [];

  const exact = roundCentavos(due);
  const suggestions = [exact];
  for (const note of TENDER_LADDER) {
    const roundedUp = Math.ceil(exact / note) * note;
    if (roundedUp > suggestions[suggestions.length - 1]) suggestions.push(roundedUp);
  }
  return suggestions;
}
