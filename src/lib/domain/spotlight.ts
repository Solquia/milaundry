/**
 * The spotlight storefront: a shop's price list the way a food app sells.
 *
 * McDonald's and Jollibee's apps open on a carousel of offers, then round
 * category pictures, then a grid where every item is a clean product shot on
 * a tinted card with its price and a cart button. This is that look over a
 * laundry's services, and this module decides what it says: which offers
 * run, which services are featured, how the services are sectioned and
 * searched, and which photo each one wears.
 *
 * Every banner is built from the shop's own data — its prices, its rating,
 * its categories. Nothing here invents a discount the shop never offered.
 */
import type { CartService } from './market-cart';
import { capacityLabel } from './price-label';
import {
  CATEGORY_LABELS,
  CATEGORY_SHORT,
  groupServicesByCategory,
  labelledServices,
  type ServiceCategory,
} from './service-catalog';
import { sceneFor, type SceneKey } from './service-scene';
import { showcasePrice, showcaseTitle } from './service-showcase';
import type { Reputation } from './storefront';

export type SpotlightService = CartService & {
  name: string;
  description?: string | null;
  /** The shop's own photo (0042); '' or absent uses the app's cut-out. */
  image_url?: string | null;
};

/** Every photo is a product shot of one kind of work. */
export type BannerPhoto = SceneKey;

export type BannerAction =
  | { kind: 'service'; serviceId: string }
  | { kind: 'category'; category: ServiceCategory }
  | { kind: 'all' };

export interface SpotlightBanner {
  key: string;
  /** The small pill over the headline: "Lowest price". */
  kicker: string;
  headline: string;
  detail: string;
  photo: BannerPhoto;
  /** What the banner's button does, and what it says. */
  action: BannerAction;
  cta: string;
}

/** A carousel longer than this is skipped through, not read. */
export const MAX_BANNERS = 4;

/** `₱35` and `/kg` — the figure and the unit it is charged in. */
export function spotlightPrice(service: SpotlightService): { figure: string; unit: string } {
  const price = showcasePrice(service);
  return { figure: price.figure, unit: price.unit ?? '' };
}

/** The cheapest payable service, first in list order on a tie. */
function cheapestOf<T extends SpotlightService>(services: readonly T[]): T | null {
  return services.reduce<T | null>((best, service) => {
    if (!Number.isFinite(service.price) || service.price <= 0) return best;
    return best === null || service.price < best.price ? service : best;
  }, null);
}

function fromLabel(services: readonly SpotlightService[]): string | null {
  const cheapest = cheapestOf(services);
  if (!cheapest) return null;
  const { figure, unit } = spotlightPrice(cheapest);
  return `from ${figure}${unit}`;
}

interface BannerInput {
  services: readonly SpotlightService[];
  reputation: Reputation | null;
}

/**
 * The carousel, in the order a customer deciding whether to order wants it:
 * what is cheapest, whether people liked it, what else the shop does, and
 * finally every service. A shop with no prices gets one banner that says so.
 */
export function spotlightBanners({ services, reputation }: BannerInput): SpotlightBanner[] {
  if (services.length === 0) {
    return [
      {
        key: 'soon',
        kicker: 'Coming soon',
        headline: 'Services are on their way',
        detail: 'This shop has not posted its prices yet.',
        photo: 'machine',
        action: { kind: 'all' },
        cta: 'See shop info',
      },
    ];
  }

  const banners: SpotlightBanner[] = [];
  const cheapest = cheapestOf(services);
  if (cheapest) {
    const { figure, unit } = spotlightPrice(cheapest);
    banners.push({
      key: 'price',
      kicker: 'Lowest price',
      headline: showcaseTitle(cheapest.name),
      detail: `Only ${figure}${unit} at this shop`,
      photo: sceneFor(cheapest.name, cheapest.category),
      action: { kind: 'service', serviceId: cheapest.id },
      cta: 'View deal',
    });
  }

  if (reputation && reputation.count > 0) {
    const reviews = reputation.count === 1 ? '1 review' : `${reputation.count} reviews`;
    banners.push({
      key: 'rating',
      kicker: 'Loved by customers',
      headline: `Rated ${reputation.average.toFixed(1)} out of 5`,
      detail: `From ${reviews} after real orders`,
      photo: 'basket',
      action: { kind: 'all' },
      cta: 'Order now',
    });
  }

  // Every category but the one the lowest price already showed, in list order.
  for (const group of groupServicesByCategory(services)) {
    if (banners.length >= MAX_BANNERS - 1) break;
    if (cheapest && group.category === cheapest.category) continue;
    const from = fromLabel(group.services);
    if (!from) continue;
    banners.push({
      key: `category-${group.category}`,
      kicker: group.services.length === 1 ? 'Also here' : `${group.services.length} choices`,
      headline: CATEGORY_LABELS[group.category],
      detail: `Starts ${from}`,
      photo: sceneFor(group.services[0].name, group.category),
      action: { kind: 'category', category: group.category },
      cta: 'Take a look',
    });
  }

  banners.push({
    key: 'all',
    kicker: 'One basket',
    headline: services.length === 1 ? 'One service, booked in a tap' : `${services.length} services, one checkout`,
    detail: 'Add what you need and check out once.',
    photo: 'machine',
    action: { kind: 'all' },
    cta: 'See all services',
  });

  return banners.slice(0, MAX_BANNERS);
}

/**
 * The featured rail: the first service of each category, then the rest in
 * list order, so the rail shows the shop's range before it shows depth. The
 * owner's own ordering is the only ranking — no sales figures are claimed.
 */
export function spotlightPicks<T extends SpotlightService>(services: readonly T[], limit = 6): T[] {
  const ordered = labelledServices(groupServicesByCategory(services)).map((entry) => entry.service);
  const seen = new Set<ServiceCategory>();
  const leads: T[] = [];
  const rest: T[] = [];
  for (const service of ordered) {
    if (seen.has(service.category)) {
      rest.push(service);
    } else {
      seen.add(service.category);
      leads.push(service);
    }
  }
  return [...leads, ...rest].slice(0, Math.max(0, limit));
}

export interface SpotlightSection<T> {
  category: ServiceCategory;
  /** The heading: "Bedding & Heavy Items". */
  title: string;
  /** The round tile's caption: "Bedding". */
  short: string;
  /** `from ₱35/kg`, or null when nothing in it has a price. */
  from: string | null;
  photo: SceneKey;
  services: T[];
}

/** The services, one section per category the shop actually sells, in the canonical order. */
export function spotlightSections<T extends SpotlightService>(services: readonly T[]): SpotlightSection<T>[] {
  return groupServicesByCategory(services).map((group) => ({
    category: group.category,
    title: CATEGORY_LABELS[group.category],
    short: CATEGORY_SHORT[group.category],
    from: fromLabel(group.services),
    photo: sceneFor(group.services[0].name, group.category),
    services: group.services,
  }));
}

/** Where in a photo a service's crop is centred, as a percent across and down. */
export interface PhotoFocus {
  x: number;
  y: number;
}

/**
 * The crops siblings take of one photo: the middle first, then each side.
 * Three "Wash & Fold" rows on one photo read as a mistake; three crops of
 * it read as three views of the same work.
 */
const FOCI: readonly PhotoFocus[] = [
  { x: 50, y: 50 },
  { x: 15, y: 40 },
  { x: 85, y: 60 },
  { x: 30, y: 80 },
  { x: 70, y: 20 },
];

export interface ServiceFrame {
  /** The app's cut-out for this kind of work, always set as the fallback. */
  photo: SceneKey;
  focus: PhotoFocus;
  /** The shop's own photo when it uploaded one; it wins over the cut-out. */
  imageUrl: string | null;
}

/** The shop's own photo, or null: an empty or blank URL is "use ours". */
export function ownImage(service: { image_url?: string | null }): string | null {
  const url = (service.image_url ?? '').trim();
  return url.length > 0 ? url : null;
}

/**
 * Services with the shop's photos laid on, from `get_shop_service_images`.
 * A service missing from the map keeps whatever it had, so a failed read
 * leaves every card on the app's cut-outs rather than blank.
 */
export function withServiceImages<T extends { id: string; image_url?: string | null }>(
  services: readonly T[],
  images: Readonly<Record<string, string>> | undefined
): T[] {
  if (!images) return [...services];
  return services.map((service) => (images[service.id] ? { ...service, image_url: images[service.id] } : service));
}

/**
 * Every service's photo and crop, decided across the whole list so siblings
 * on one photo differ. Pass the full list: a filter should not re-crop a row.
 */
export function serviceFrames(services: readonly SpotlightService[]): Map<string, ServiceFrame> {
  const used = new Map<SceneKey, number>();
  const frames = new Map<string, ServiceFrame>();
  for (const service of services) {
    const photo = sceneFor(service.name, service.category);
    const index = used.get(photo) ?? 0;
    used.set(photo, index + 1);
    frames.set(service.id, { photo, focus: FOCI[index % FOCI.length], imageUrl: ownImage(service) });
  }
  return frames;
}

/** The basket line on a row's photo: "2 in basket", or "In basket" for a load. */
export function basketBadge(quantity: number, isALoad: boolean): string | null {
  if (quantity <= 0) return null;
  return isALoad ? 'In basket' : `${quantity} in basket`;
}

/** The cheapest payable service's id, for the card that earns the "Lowest price" tag. */
export function cheapestId(services: readonly SpotlightService[]): string | null {
  return cheapestOf(services)?.id ?? null;
}

/**
 * The pill in a card's corner: "Lowest price" on the one service that is, and
 * otherwise how it is charged — a fact, never a "Bestseller" nobody measured.
 */
export function cardTag(service: SpotlightService, lowestId: string | null): string {
  if (service.id === lowestId) return 'Lowest price';
  if (service.unit === 'per_kg') return 'Per kg';
  if (service.unit === 'per_item') return 'Per piece';
  return capacityLabel(service) ? 'Per load' : 'Flat rate';
}

/** Whether a service answers a search: every word in its name or description. */
export function matchesQuery(service: SpotlightService, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = `${service.name} ${service.description ?? ''}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}
