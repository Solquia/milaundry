/**
 * The type and the shapes, decided once.
 *
 * Two things made the product feel boxy and formal. The type scale ran
 * 17 / 15 / 14 / 12 with no line heights, so three roles sat within three
 * pixels of each other and every screen quietly overrode them — there was a
 * de-facto 16 / 15 / 14 / 13 scale operating underneath the declared one. And
 * there was no radius token at all, so thirteen different corner radii were
 * in use, a card and the control inside it one step apart, which reads as no
 * step at all.
 *
 * Both now live here as data, which is why they can be tested: a scale whose
 * steps are too small to see is a bug, not a matter of taste.
 */

/**
 * Figtree, a warm geometric face with open counters and friendly numerals.
 *
 * React Native picks a weight by *family*, not by `fontWeight` — asking for
 * 700 on a custom face gets a synthesised bold on Android and nothing at all
 * on some devices. So every weight is its own family, and roles name theirs.
 */
export const FONT = {
  regular: 'Figtree_400Regular',
  medium: 'Figtree_500Medium',
  semibold: 'Figtree_600SemiBold',
  bold: 'Figtree_700Bold',
  extrabold: 'Figtree_800ExtraBold',
} as const;

export type FontFamily = (typeof FONT)[keyof typeof FONT];

const CUTS: readonly (readonly [number, FontFamily])[] = [
  [400, FONT.regular],
  [500, FONT.medium],
  [600, FONT.semibold],
  [700, FONT.bold],
  [800, FONT.extrabold],
];

/**
 * The family for a weight, rounded to the nearest cut the face ships.
 *
 * A weight exactly between two cuts takes the heavier one. Text that lands a
 * step bolder than asked still reads; a step lighter can disappear against a
 * tinted surface.
 */
export function fontFor(weight: number): FontFamily {
  let best = CUTS[0];
  for (const cut of CUTS) {
    if (Math.abs(cut[0] - weight) <= Math.abs(best[0] - weight)) best = cut;
  }
  return best[1];
}

export interface TypeRole {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  fontFamily: FontFamily;
}

/**
 * Seven roles, each a step you can see.
 *
 * Sizes run 34 / 26 / 22 / 19 / 16 / 14 / 13. Body sits at 16 because that is
 * the reading floor, and `section` moved up to 19 so a heading is unmistakably
 * a heading beside it. Tracking tightens as the size grows, which is how a
 * geometric face keeps its colour at display sizes, and never passes -0.04em.
 */
export const TYPE_ROLES = {
  hero: { fontSize: 34, lineHeight: 40, letterSpacing: -1, fontFamily: FONT.extrabold },
  title: { fontSize: 26, lineHeight: 31, letterSpacing: -0.6, fontFamily: FONT.bold },
  value: { fontSize: 22, lineHeight: 26, letterSpacing: -0.4, fontFamily: FONT.bold },
  section: { fontSize: 19, lineHeight: 24, letterSpacing: -0.3, fontFamily: FONT.bold },
  body: { fontSize: 16, lineHeight: 23, letterSpacing: 0, fontFamily: FONT.regular },
  label: { fontSize: 14, lineHeight: 18, letterSpacing: 0.1, fontFamily: FONT.semibold },
  caption: { fontSize: 13, lineHeight: 17, letterSpacing: 0.1, fontFamily: FONT.regular },
} as const satisfies Record<string, TypeRole>;

export type RoleName = keyof typeof TYPE_ROLES;

/** Largest to smallest, so the scale can be checked for ties. */
export const ROLE_ORDER = ['hero', 'title', 'value', 'section', 'body', 'label', 'caption'] as const;

/**
 * One radius scale, generous at every step.
 *
 * The old set had a card at 14 and the control inside it at 12, a difference
 * nobody can see. Each step here is worth making, and the smallest is still
 * round enough that nothing on screen has a corner.
 */
export const RADII = {
  hair: 6,
  chip: 10,
  control: 14,
  card: 20,
  sheet: 26,
  pill: 999,
} as const;

/**
 * The crown: a sheet rounded more at the head than at the foot.
 *
 * A rectangle with four equal corners is a box however round they are. Taking
 * the top two further than the bottom two gives the shape a direction — it
 * reads as something drawn, resting on the page, rather than as a container.
 */
export const CROWN = {
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  borderBottomLeftRadius: 20,
  borderBottomRightRadius: 20,
} as const;
