/**
 * Thick and heavy extras on a booking: comforters, curtains, big beddings.
 *
 * Each extra used to carry its own readout ("0 pieces", 64pt) and its own
 * rail of count pills, so two extras filled a phone screen before anyone had
 * one. Most customers add none, and the rest add one or two, so an extra is
 * now a small tile in a grid. What that tile says is decided here.
 */
import { MAX_WEIGHT_KG } from './booking-estimate';
import { formatMoneyCompact } from './money';
import { estimateLineTotal, type PricingUnit, type Service } from './pricing';
import { MAX_PIECES } from './quantity-input';
import { showcaseTitle } from './service-showcase';

/**
 * The most one tap of + can reach for this unit. A flat extra counts like
 * pieces — three comforters at a flat ₱200 are three flat charges — and goes
 * to the shop as one line per piece (see `buildBookingItems`).
 */
export function extraLimit(unit: PricingUnit): number {
  return unit === 'per_kg' ? MAX_WEIGHT_KG : MAX_PIECES;
}

/**
 * One tap of − or +. Whole kilos and whole pieces: a stepper that moves in
 * halves makes the customer tap twice for every kilo they meant.
 */
export function stepExtra(unit: PricingUnit, quantity: number, direction: 1 | -1): number {
  const current = Number.isFinite(quantity) ? quantity : 0;
  const next = direction === 1 ? Math.floor(current) + 1 : Math.ceil(current) - 1;
  return Math.min(extraLimit(unit), Math.max(0, next));
}

const RATE_SUFFIX: Record<PricingUnit, string> = {
  per_item: '/pc',
  per_kg: '/kg',
  flat: '',
};

/**
 * The price on a tile: the short rate until something is added, then what the
 * added amount is billed. The billed line, so a minimum shows as the figure
 * that will be charged rather than as quantity times rate.
 */
export function extraTilePrice(service: Service, quantity: number): string {
  if (!(quantity > 0)) return `${formatMoneyCompact(service.price)}${RATE_SUFFIX[service.unit]}`;
  if (service.unit === 'flat') return formatMoneyCompact(service.price * quantity);
  return formatMoneyCompact(estimateLineTotal(service, quantity));
}

export interface ExtraLabel {
  /** The thing itself: "Comforter". */
  title: string;
  /** Which kind, when the shop's name says: "Extra thick / XL". */
  variant: string | null;
}

/** "Comforter — Extra Thick", "Comforter (King size)", "Curtains - heavy". */
const VARIANT_SPLIT = /^(.+?)\s+[—–-]\s+(.+)$|^(.+?)\s*\((.+)\)$/;

function sentenceCase(text: string): string {
  return text
    .replace(/extra[\s-]*large/gi, 'XL')
    .split(' ')
    .map((word, index) => {
      if (/^[A-Z]{2,3}$/.test(word)) return word;
      const lower = word.toLowerCase();
      return index === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
    })
    .join(' ');
}

/**
 * A shop's item name, split so a tile can set the thing large and the variant
 * small. "Comforter — Extra Thick / Extra Large" wrapped onto two lines at
 * full size; as a title and a caption it fits a tile a third the width.
 */
export function extraLabel(name: string): ExtraLabel {
  const calm = showcaseTitle(name);
  const match = calm.match(VARIANT_SPLIT);
  if (!match) return { title: calm, variant: null };
  const title = (match[1] ?? match[3]).trim();
  const variant = (match[2] ?? match[4]).trim();
  return { title, variant: sentenceCase(variant) };
}

/** Which drawing an extra's tile shows. The component draws each one. */
export type ExtraArt =
  | 'sheets'
  | 'blanket'
  | 'comforter'
  | 'bulky'
  | 'pillow'
  | 'rug'
  | 'toy'
  | 'curtain'
  | 'shoe'
  | 'sack';

const BEDDING = /comforter|duvet|quilt/i;
const OVERSIZED = /thick|\bxl\b|extra[\s-]*large|king|queen|jumbo/i;

/** Read in order: the first match wins, so "Bedsheets & Blankets" is sheets. */
const ART_WORDS: readonly [RegExp, ExtraArt][] = [
  [/sheet|linen/i, 'sheets'],
  [/blanket|fleece|throw/i, 'blanket'],
  [BEDDING, 'comforter'],
  [/pillow|cushion/i, 'pillow'],
  [/rug|carpet|\bmat\b/i, 'rug'],
  [/stuffed|toy|plush/i, 'toy'],
  [/curtain|drape/i, 'curtain'],
  [/shoe|sneaker/i, 'shoe'],
];

/**
 * A drawing for an extra, read from its name, so four heavy items stop
 * looking like four copies of one throw. An oversized comforter gets a
 * bulkier drawing than a plain one; anything unnamed is a big laundry sack.
 */
export function extraArt(name: string): ExtraArt {
  if (BEDDING.test(name) && OVERSIZED.test(name)) return 'bulky';
  return ART_WORDS.find(([pattern]) => pattern.test(name))?.[1] ?? 'sack';
}
