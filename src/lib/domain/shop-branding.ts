/**
 * A shop's own face.
 *
 * Until now every shop's colour was derived from a hash of its id — stable and
 * distinct, but nobody's *choice*. A laundry that has spent money on a teal
 * signboard had no way to be teal in the app. This adds the choice while
 * keeping the hash as the default, so a shop that never opens the branding
 * screen looks exactly as it always has.
 *
 * The hashing itself stays in `accent.ts`; this module only decides when a
 * shop's own answer outranks it.
 */
import { accentIndex } from './accent';

export interface BrandedShop {
  id: string;
  /** Palette index the shop chose; null means "use the hash". */
  brand_accent: number | null;
}

/** Whether a value is an index this palette actually has. */
export function isValidAccent(index: unknown, count: number): boolean {
  return (
    typeof index === 'number' &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < count
  );
}

/**
 * The tone a shop wears on its own.
 *
 * An index the palette no longer has falls back to the hash rather than
 * wrapping with modulo: a stale choice should degrade to the shop's *stable*
 * colour, not to an arbitrary different one.
 */
export function resolveAccent(shop: BrandedShop, count: number): number {
  if (isValidAccent(shop.brand_accent, count)) return shop.brand_accent as number;
  return accentIndex(shop.id, count);
}

/**
 * One tone per shop, in list order, with chosen tones held fixed.
 *
 * `assignAccents` in `accent.ts` walks a shop off its preferred colour when an
 * earlier one took it — right, when neither shop ever expressed a preference.
 * A merchant who deliberately picked their brand colour outranks that walk, so
 * chosen tones are reserved first and never moved, even if two shops picked the
 * same one. Only the unbranded shops walk, and they walk around the choices.
 */
export function assignBrandAccents(
  shops: readonly BrandedShop[],
  count: number
): number[] {
  if (!Number.isInteger(count) || count < 1) return shops.map(() => 0);

  const taken = new Set<number>();
  for (const shop of shops) {
    if (isValidAccent(shop.brand_accent, count)) taken.add(shop.brand_accent as number);
  }

  return shops.map((shop) => {
    if (isValidAccent(shop.brand_accent, count)) return shop.brand_accent as number;

    const preferred = accentIndex(shop.id, count);
    // Beyond `count` shops repeats are unavoidable; a stable colour then beats
    // an arbitrary one, exactly as accent.ts reasons.
    if (taken.size >= count) return preferred;

    let chosen = preferred;
    while (taken.has(chosen)) chosen = (chosen + 1) % count;
    taken.add(chosen);
    return chosen;
  });
}

/**
 * One line on the shopfront, under the shop's name. Long enough for "Same-day
 * wash, fold & press", short enough that it cannot wrap into a paragraph and
 * push the price list below the fold.
 */
export const MAX_TAGLINE = 60;

/**
 * A tagline as typed. Returns the cleaned string, or null when it is too long
 * for the caller to say so. An empty result is valid — clearing a tagline is a
 * thing a shop is allowed to do.
 */
export function validateTagline(input: string): string | null {
  // The shopfront gives this one line, so any whitespace the merchant pasted —
  // newlines included — collapses to single spaces rather than being swallowed.
  const cleaned = input.replace(/\s+/g, ' ').trim();
  return cleaned.length > MAX_TAGLINE ? null : cleaned;
}
