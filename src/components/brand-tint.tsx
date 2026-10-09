/**
 * Whose blue a screen is painted in.
 *
 * Almost everything in the app wears the app's own action blue. A shop on the
 * spotlight look asks for its checkout to wear the shop's colour instead, so
 * the basket, the steps and "Place order" read as the same store the customer
 * was just browsing. Rather than fork every checkout component, the colours
 * they act in come from here: the shop's accent inside a `BrandTintProvider`,
 * and the app's blue (`useTint` in ui-kit) everywhere else.
 *
 * Nothing here imports ui-kit, because ui-kit's Button reads this.
 */
import { createContext, useContext } from 'react';

export interface BrandTint {
  /** A filled action: a primary button, a chosen chip. White text sits on it. */
  fill: string;
  /** The colour as text or an icon on white. */
  ink: string;
  /** A soft field: a chosen row, a tinted well. */
  surface: string;
  /** Rule weight: a track, an unchosen tick. */
  muted: string;
}

/** A shop accent (`ACCENTS`) as a tint. Its ink clears AA with white text on it. */
export function tintFromAccent(accent: { ink: string; surface: string }): BrandTint {
  return { fill: accent.ink, ink: accent.ink, surface: accent.surface, muted: accent.surface };
}

const BrandTintContext = createContext<BrandTint | null>(null);

export const BrandTintProvider = BrandTintContext.Provider;

/** The tint a provider set, or null where none did; `useTint` fills in the app's blue. */
export function useBrandTint(): BrandTint | null {
  return useContext(BrandTintContext);
}
