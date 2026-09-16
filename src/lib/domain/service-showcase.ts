/**
 * What a service says about itself on a showcase card.
 *
 * The price list used to be rows: a name, a figure, a chevron. Rows are honest
 * but they have no face — every shop's list looked like every other shop's,
 * and a service the owner never described was a name and a number with a hole
 * between them. A showcase card gives each service a tile in a colour of its
 * own, a title that reads like a title, a line about what it is, and the price
 * standing where the eye lands last.
 *
 * Everything the card *says* is decided here, so the app card and the web
 * card cannot drift apart, and so the words are pinned by tests rather than
 * by whoever last touched a component.
 */
import { formatMoneyCompact } from './money';
import { minimumLabel, unitCaption } from './price-label';
import type { Service } from './pricing';
import type { ServiceCategory } from './service-catalog';

/** A titled, categorised service — what the storefront and the app both hold. */
export interface ShowcaseService extends Service {
  category: ServiceCategory;
  description?: string | null;
}

/** Below this many letters an all-caps name may be an acronym; leave it. */
const ACRONYM_LENGTH = 3;

/**
 * The name as a title. Owners type in caps because the till does, and
 * "WASH AND FOLD" on a card reads as a warning rather than a service. A name
 * that is entirely upper case comes back in title case; anything the shop
 * cased itself is theirs and stays.
 */
export function showcaseTitle(name: string): string {
  const trimmed = name.trim();
  const letters = trimmed.replace(/[^\p{L}]/gu, '');
  const isShouted = letters.length > ACRONYM_LENGTH && letters === letters.toUpperCase();
  if (!isShouted) return trimmed;
  return trimmed
    .toLowerCase()
    .replace(/(^|[\s(\-/—–])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
}

const CATEGORY_BLURBS: Record<ServiceCategory, string> = {
  wash_fold: 'Washed, dried and folded, ready to wear.',
  ironing: 'Pressed crisp and hung, ready for the week.',
  dry_cleaning: 'Gentle care for the pieces that matter most.',
  special_items: 'Comforters, blankets and the big, heavy loads.',
  self_service: 'Your load, your machine, on your own time.',
  other: 'Ask the shop and they will tell you more.',
};

/**
 * The line under the title: the shop's own words when it wrote any, and a
 * line for its category when it did not. A card with a blank where the
 * description should be looks unfinished; a card that says nothing untrue
 * about wash-and-fold looks cared for.
 */
export function showcaseBlurb(service: ShowcaseService): string {
  const own = (service.description ?? '').trim();
  if (own) return own;
  return CATEGORY_BLURBS[service.category] ?? CATEGORY_BLURBS.other;
}

export interface ShowcasePrice {
  /** `₱176` — the figure, no centavos it never had. */
  figure: string;
  /**
   * The currency mark on its own.
   *
   * Figtree ships no peso glyph, so the platform substitutes another face for
   * it. Set at the same size and weight as the digits beside it, that
   * substitution reads as a mistake — a taller, thinner sign floating off the
   * baseline. Split out, a card can set it smaller and quieter, which is how
   * a currency mark should be set anyway: the number is the information.
   */
  symbol: string;
  /** `176`, or `2,841`, or `60.50` — everything the symbol is not. */
  amount: string;
  /** `/kg`, `/piece`, or null for a flat price that needs no unit. */
  unit: string | null;
  /** `2 kg minimum`, or null when the shop set none. */
  minimum: string | null;
}

/** The price in its three parts, so a card can size each one differently. */
export function showcasePrice(service: ShowcaseService): ShowcasePrice {
  const figure = formatMoneyCompact(service.price);
  const mark = figure.indexOf('₱');
  return {
    figure,
    symbol: mark === -1 ? '' : '₱',
    amount: mark === -1 ? figure : figure.slice(mark + 1),
    unit: unitCaption(service.unit),
    minimum: minimumLabel(service),
  };
}

export interface ShowcaseTone {
  /** The tile: the category's colour at full strength, with the glyph in white on it. */
  bg: string;
  /** The same hue deep enough to write the title in, on the card. */
  ink: string;
  /**
   * The card's own ground: the same hue at a whisper.
   *
   * The cards were white, on the reasoning that colour on them would compete
   * with the object. Six white boxes in a grid is a spreadsheet, though, and
   * the category was left to a chip in the corner that nobody reads before the
   * price. At this strength the ground never competes with the drawing — it is
   * lighter than the page it sits on — but it does mean a customer sorts wash
   * from dry-cleaning by the colour of the tile rather than by reading it.
   */
  field: string;
}

/**
 * One colour per category, so a price list with five kinds of service shows
 * five kinds of tile instead of five blue squares. The tile is the colour at
 * full strength — a block of it, the glyph white on top — and the ink is the
 * same hue deep enough to clear 4.5:1 as a title on the white card.
 */
const CATEGORY_TONES: Record<ServiceCategory, ShowcaseTone> = {
  wash_fold: { bg: '#2B7FE0', ink: '#0F5FB8', field: '#E4EFFC' },
  ironing: { bg: '#F0742A', ink: '#B4470F', field: '#FDEDE2' },
  dry_cleaning: { bg: '#7B5CE5', ink: '#5B3DB8', field: '#EDE7FB' },
  special_items: { bg: '#1FA46A', ink: '#0B6B44', field: '#E0F3EA' },
  self_service: { bg: '#F2B233', ink: '#8A5A05', field: '#FCF1DC' },
  other: { bg: '#6B7C93', ink: '#43536B', field: '#ECEFF4' },
};

export function showcaseTone(category: ServiceCategory): ShowcaseTone {
  return CATEGORY_TONES[category] ?? CATEGORY_TONES.other;
}
