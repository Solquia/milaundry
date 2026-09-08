/**
 * A shop's accent, turned into the tokens its web page paints with.
 *
 * In the app an accent is a pale surface and a dark ink, used for a badge or a
 * ring around initials. On the shop's own web page the same pair has to carry
 * a whole storefront: the hero field, the call to action, the price list's
 * headings. So the ink becomes the brand colour and white sits on it, and the
 * surface becomes the soft field behind secondary things. The contrast test
 * next door checks every accent in the palette on both grounds, so a new tone
 * added to the app cannot quietly ship an unreadable web page.
 */

export interface Accent {
  surface: string;
  ink: string;
}

export interface StorefrontTheme {
  /** The shop's colour, as a solid: hero, buttons, active states. */
  brand: string;
  /** Text and icons on `brand`. */
  onBrand: string;
  /** The pale field for chips and secondary surfaces. */
  brandSoft: string;
  /** Text on `brandSoft`. */
  brandInk: string;
}

const WHITE = '#FFFFFF';

export function storefrontTheme(accent: Accent): StorefrontTheme {
  return {
    brand: accent.ink,
    onBrand: WHITE,
    brandSoft: accent.surface,
    brandInk: accent.ink,
  };
}

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance of a `#RRGGBB` colour. */
function luminance(hex: string): number {
  const clean = hex.replace('#', '');
  return 0.2126 * channel(clean, 0) + 0.7152 * channel(clean, 2) + 0.0722 * channel(clean, 4);
}

/** WCAG contrast ratio between two `#RRGGBB` colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [light, dark] = la >= lb ? [la, lb] : [lb, la];
  return (light + 0.05) / (dark + 0.05);
}
