/**
 * A shop's price guide, for a shop whose menu does not fit one row per service.
 *
 * Bubbly Gav sells three wash-dry-fold packages. Each is one decision with a
 * few inside it: regular clothes or beddings, which soap, which fabcon, and a
 * price that moves with the weight. Beside them it cleans shoes, caps,
 * helmets, bags and sofas in a basic and a deep grade, and dries laundry
 * washed elsewhere.
 *
 * Every price comes from the shop's own services, so the owner corrects one
 * in the service editor and the guide follows: the packages are the services
 * named "Package N…", their weight tables are `weight_prices`, the other
 * services are the remaining special items (grouped by the name before " · "),
 * and drying is the "other" section. What is kept here is only what a
 * service row cannot say: the poster's colours, the soap and fabcon photos for
 * each package, and the shop's rules about loads.
 */
import type { ServiceCategory } from './service-catalog';
import { readWeightPrices, weightBands, type WeightBand, type WeightPrice } from './weight-prices';

export const BUBBLY_GAV_SHOP_ID = 'f858c7ec-146b-444b-a6b1-93ebed38fae6';

export type GuideTone = 'blue' | 'green' | 'orange';

export interface GuideProduct {
  name: string;
  /** Key of the cropped photo under assets/images/price-guides/<shop>/. */
  photo: string;
}

/** What a package says about itself that its service row cannot. */
export interface GuidePackageLook {
  number: number;
  tone: GuideTone;
  detergentTitle: string;
  detergents: GuideProduct[];
  fabcons: GuideProduct[];
}

export interface PriceGuide {
  title: string;
  tagline: string;
  packages: GuidePackageLook[];
  /** How weight turns into loads, shared by every package. */
  loadRules: { icon: 'scale' | 'add-circle' | 'copy'; text: string }[];
}

/** The fields of a service the guide reads. */
export interface GuideService {
  id: string;
  name: string;
  category: ServiceCategory;
  price: number;
  description?: string | null;
  sort_order?: number;
  max_quantity?: number;
  weight_prices?: readonly WeightPrice[];
}

/** What goes in the machine: each is its own service, load size and table. */
export type VariantKind = 'clothes' | 'fabrics' | 'beddings';

export interface MenuVariant<S extends GuideService> {
  kind: VariantKind;
  title: string;
  service: S;
  /** How much one load holds: the service's own limit, else the kind's usual. */
  perLoadKg: number;
  weights: WeightBand[];
}

export interface MenuPackage<S extends GuideService> {
  number: number;
  /** Regular clothes, then heavy fabrics, then beddings — whichever the shop sells. */
  variants: MenuVariant<S>[];
}

export interface MenuGroup<S extends GuideService> {
  /** "Shoe cleaning" */
  name: string;
  /** "Basic", "Deep" — or one option with no label. */
  options: { label: string; service: S }[];
}

export interface GuideMenu<S extends GuideService> {
  packages: MenuPackage<S>[];
  others: MenuGroup<S>[];
  /** Garments by the piece, under the shop's own board headings: Gowns, Jackets… */
  dryCleaning: { heading: string; groups: MenuGroup<S>[] }[];
  drying: S[];
}

/** "Up to 8 kg", "9 kg", "10.5 – 11 kg". */
export function weightLabel({ from, to }: { from: number; to: number }): string {
  if (from === 0) return `Up to ${to} kg`;
  if (from === to) return `${from} kg`;
  return `${from} – ${to} kg`;
}

const PACKAGE_NAME = /^package\s*(\d+)/i;
const BEDDING_WORDS = /bed|towel|linen|kumot/i;
/** Denim and jackets: heavy in the drum, so the shop loads them lighter. */
const FABRIC_WORDS = /maong|jean|denim|cargo|jacket|pants/i;

const VARIANTS: Record<VariantKind, { title: string; usualLoadKg: number; order: number }> = {
  clothes: { title: 'Regular clothes', usualLoadKg: 8, order: 0 },
  fabrics: { title: 'Maong, cargo & jackets', usualLoadKg: 8, order: 1 },
  beddings: { title: 'Beddings & towels', usualLoadKg: 4, order: 2 },
};

function variantKind(name: string): VariantKind {
  if (BEDDING_WORDS.test(name)) return 'beddings';
  if (FABRIC_WORDS.test(name)) return 'fabrics';
  return 'clothes';
}
/** "Shoe cleaning · Deep", "Shoe cleaning - Deep" */
const OPTION_SEPARATOR = /\s+[·•|–-]\s+/;

/** The board a dry-cleaning item is printed on, read from its name. */
const DRY_CLEANING_HEADINGS: readonly [RegExp, string][] = [
  [/wedding|bridal/i, 'Wedding dress'],
  [/gown/i, 'Gowns'],
  [/leather/i, 'Leather jackets'],
  [/jacket|coat|blazer/i, 'Jackets'],
  [/toga/i, 'Graduation toga'],
  [/pants|slacks|trouser/i, 'Pants'],
];

export function dryCleaningHeading(name: string): string {
  return DRY_CLEANING_HEADINGS.find(([pattern]) => pattern.test(name))?.[1] ?? 'More dry cleaning';
}

/** A price the board prints as a range or "and up": the row shows it as "from". */
export function isFromPrice(description: string | null | undefined): boolean {
  return /–|and up/i.test(description ?? '');
}

function bySortThenName<S extends GuideService>(a: S, b: S): number {
  return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name);
}

/** The shop's services, sorted into the guide's three sections. */
export function guideMenu<S extends GuideService>(services: readonly S[]): GuideMenu<S> {
  const byNumber = new Map<number, Map<VariantKind, S>>();
  const others = new Map<string, MenuGroup<S>>();
  const drying: S[] = [];
  const dryCleaning = new Map<string, Map<string, MenuGroup<S>>>();

  for (const service of [...services].sort(bySortThenName)) {
    const packageNumber = Number(PACKAGE_NAME.exec(service.name)?.[1]);
    if (packageNumber > 0) {
      const entry = byNumber.get(packageNumber) ?? new Map<VariantKind, S>();
      const kind = variantKind(service.name);
      if (!entry.has(kind)) entry.set(kind, service);
      byNumber.set(packageNumber, entry);
      continue;
    }
    if (service.category === 'other') {
      drying.push(service);
      continue;
    }
    const [base, ...rest] = service.name.split(OPTION_SEPARATOR);
    if (service.category === 'dry_cleaning') {
      const heading = dryCleaningHeading(service.name);
      const section = dryCleaning.get(heading) ?? new Map<string, MenuGroup<S>>();
      const item = section.get(base) ?? { name: base, options: [] };
      item.options.push({ label: rest.join(' '), service });
      section.set(base, item);
      dryCleaning.set(heading, section);
      continue;
    }
    const group = others.get(base) ?? { name: base, options: [] };
    group.options.push({ label: rest.join(' '), service });
    others.set(base, group);
  }

  const packages = [...byNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, entry]) => ({
      number,
      variants: [...entry.entries()]
        .sort(([a], [b]) => VARIANTS[a].order - VARIANTS[b].order)
        .map(([kind, service]) => ({
          kind,
          title: VARIANTS[kind].title,
          service,
          perLoadKg:
            Number(service.max_quantity) > 0 ? Number(service.max_quantity) : VARIANTS[kind].usualLoadKg,
          weights: weightBands(readWeightPrices(service.weight_prices)),
        })),
    }));
  return {
    packages,
    others: [...others.values()],
    dryCleaning: [...dryCleaning.entries()].map(([heading, section]) => ({
      heading,
      groups: [...section.values()],
    })),
    drying,
  };
}

const BUBBLY_GAV: PriceGuide = {
  title: 'Wash · Dry · Fold',
  tagline: 'Trusted wash for every home',
  packages: [
    {
      number: 1,
      tone: 'blue',
      detergentTitle: 'Choose your detergent',
      detergents: [
        { name: 'Membership Value', photo: 'membership-value' },
        { name: 'Champion', photo: 'champion' },
        { name: 'Surf', photo: 'surf' },
      ],
      fabcons: [
        { name: 'Calla Pink', photo: 'calla-pink' },
        { name: 'Calla Blue', photo: 'calla-blue' },
      ],
    },
    {
      number: 2,
      tone: 'green',
      detergentTitle: 'Liquid detergent',
      detergents: [{ name: 'Ariel', photo: 'ariel' }],
      fabcons: [
        { name: 'Del Gentle Protect', photo: 'del-gentle' },
        { name: 'Del Lavender', photo: 'del-lavender' },
        { name: 'Champion Antibac', photo: 'champion-antibac' },
        { name: 'Personal Collection', photo: 'personal-collection' },
      ],
    },
    {
      number: 3,
      tone: 'orange',
      detergentTitle: 'Choose your detergent',
      detergents: [
        { name: 'Tide', photo: 'tide' },
        { name: 'Arm & Hammer', photo: 'arm-hammer' },
        { name: 'Persil', photo: 'persil' },
        { name: 'Gain', photo: 'gain' },
      ],
      fabcons: [
        { name: 'PC Eternity', photo: 'pc-eternity' },
        { name: 'PC All Time Fresh', photo: 'pc-all-time-fresh' },
        { name: 'PC Pink', photo: 'pc-pink' },
        { name: 'Downy April Fresh', photo: 'downy' },
      ],
    },
  ],
  loadRules: [
    { icon: 'scale', text: 'Max 8 kg per load for clothes, 4 kg for beddings — we never overload the machines.' },
    { icon: 'add-circle', text: 'Over 8 kg: +₱15 for every extra ½ kg, +₱30 for every extra 1 kg.' },
    { icon: 'copy', text: '10 kg and up is split into 2 loads for a proper wash and tumble.' },
  ],
};

const GUIDES: Readonly<Record<string, PriceGuide>> = {
  [BUBBLY_GAV_SHOP_ID]: BUBBLY_GAV,
};

/** The shop's own price guide, or null for a shop whose services say it all. */
export function priceGuideFor(shopId: string | null | undefined): PriceGuide | null {
  if (!shopId) return null;
  return GUIDES[shopId] ?? null;
}
