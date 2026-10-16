/**
 * The type and the shapes, decided once.
 *
 * The product is set the way an Apple app is set: the system face on an
 * iPhone, the iOS text-style sizes, tracking that tightens as type grows, and
 * one continuous corner on every card. Both live here as data, which is why
 * they can be tested: a scale whose steps are too small to see is a bug, not a
 * matter of taste.
 */
import { Platform, type TextStyle } from 'react-native';

/**
 * Inter, for the platforms that do not ship San Francisco.
 *
 * Android selects a custom face by *family*, not by `fontWeight` — asking for
 * 700 on a custom face gets a synthesised bold, or nothing. So every weight is
 * its own family there. Inter was drawn for the same job SF was — UI text at
 * small sizes — and it is the nearest open face to it.
 */
export const INTER = {
  400: 'Inter_400Regular',
  500: 'Inter_500Medium',
  600: 'Inter_600SemiBold',
  700: 'Inter_700Bold',
  800: 'Inter_800ExtraBold',
} as const;

export type Cut = keyof typeof INTER;
const CUTS: readonly Cut[] = [400, 500, 600, 700, 800];

/**
 * The browser's face: San Francisco on every Apple device, Inter (loaded by
 * `web-document.ts`) everywhere else, then each platform's own UI face.
 */
export const WEB_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", Inter, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** The nearest weight the faces ship; a tie takes the heavier cut. */
export function nearestCut(weight: number): Cut {
  let best = CUTS[0];
  for (const cut of CUTS) {
    if (Math.abs(cut - weight) <= Math.abs(best - weight)) best = cut;
  }
  return best;
}

export interface FontStyle {
  fontFamily: string;
  fontWeight?: TextStyle['fontWeight'];
}

/** The face for a weight on a given platform. Pure, so every branch is testable. */
export function fontForPlatform(weight: number, os: string): FontStyle {
  const cut = nearestCut(weight);
  const fontWeight = String(cut) as TextStyle['fontWeight'];
  if (os === 'ios') return { fontFamily: 'System', fontWeight };
  if (os === 'android') return { fontFamily: INTER[cut] };
  return { fontFamily: WEB_FONT_STACK, fontWeight };
}

/** The face for a weight on this device. Spread it: `{ ...fontFor(600) }`. */
export function fontFor(weight: number): FontStyle {
  return fontForPlatform(weight, Platform.OS);
}

export interface TypeRole extends FontStyle {
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
}

function role(fontSize: number, lineHeight: number, letterSpacing: number, weight: number): TypeRole {
  return { fontSize, lineHeight, letterSpacing, ...fontFor(weight) };
}

/**
 * Seven roles, on the iOS text styles.
 *
 *   hero    34 bold      Large Title — the one line a screen exists to say
 *   title   28 bold      Title 1
 *   value   22 semibold  Title 2 — a figure: a price, a total
 *   section 20 bold      Title 3 — the heading over a group
 *   body    16 regular   Callout
 *   label   14 semibold  a row's name, a button
 *   caption 13 regular   Footnote
 *
 * Tracking follows apple.com's: slightly negative at reading sizes and
 * tighter as the size grows, so display type holds together as a word.
 */
export const TYPE_ROLES = {
  hero: role(34, 41, -0.9, 700),
  title: role(28, 34, -0.6, 700),
  value: role(22, 28, -0.45, 600),
  section: role(20, 25, -0.4, 700),
  body: role(16, 22, -0.25, 400),
  label: role(14, 19, -0.1, 600),
  caption: role(13, 18, -0.05, 400),
} as const satisfies Record<string, TypeRole>;

export type RoleName = keyof typeof TYPE_ROLES;

/** Largest to smallest, so the scale can be checked for ties. */
export const ROLE_ORDER = ['hero', 'title', 'value', 'section', 'body', 'label', 'caption'] as const;

/** One radius scale. The card step matches an iOS widget's corner. */
export const RADII = {
  hair: 6,
  chip: 10,
  control: 14,
  card: 22,
  sheet: 28,
  pill: 999,
} as const;

/**
 * A card's corner: even all round, and drawn as a continuous curve — the
 * squircle iOS uses for icons and cards — wherever the platform can draw one.
 * Platforms without it fall back to the plain arc at the same radius.
 */
export const CROWN = {
  borderRadius: RADII.card,
  borderCurve: 'continuous',
} as const;
