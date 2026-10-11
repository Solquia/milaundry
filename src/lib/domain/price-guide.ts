/**
 * A shop's printed price guide, for a shop whose prices do not fit one row
 * per service.
 *
 * Bubbly Gav prices a load by package *and* by weight: the package names the
 * soap and fabcon you choose from, and every half kilo past 8 adds to it until
 * the load is split in two. Its walls also carry drying packages and sneaker
 * and cap care. The service rows still carry what can be booked; this is the
 * board on the wall, drawn on the shop's page so a customer reads the same
 * prices at home as at the counter.
 *
 * Kept as data here rather than in the database because only one shop has
 * one, and its shape is that shop's own. Photos are named by key, so this file
 * stays plain data the tests can read; `price-guide.tsx` maps a key to a file.
 */

export const BUBBLY_GAV_SHOP_ID = 'f858c7ec-146b-444b-a6b1-93ebed38fae6';

export type GuideTone = 'blue' | 'green' | 'orange';

export interface GuideProduct {
  name: string;
  /** Key of the cropped photo under assets/images/price-guides/<shop>/. */
  photo: string;
}

export interface WeightBand {
  from: number;
  to: number;
}

export interface WeightRow extends WeightBand {
  loads: 1 | 2;
  price: number;
}

export interface GuidePackage {
  label: string;
  tone: GuideTone;
  /** Per load, up to 8 kg. */
  price: number;
  detergentTitle: string;
  detergents: GuideProduct[];
  fabcons: GuideProduct[];
  weights: WeightRow[];
}

export interface GuideOption {
  name: string;
  price: number;
  points: string[];
}

export interface RestoreItem {
  name: string;
  icon: 'footsteps' | 'baseball';
  blurb: string;
  tiers: { name: string; price: number }[];
}

export interface PriceGuide {
  title: string;
  tagline: string;
  packages: GuidePackage[];
  /** How weight turns into loads, shared by every package. */
  loadRules: { icon: 'scale' | 'add-circle' | 'copy'; text: string }[];
  drying: { limits: string[]; options: GuideOption[] };
  restore: { photo: string; items: RestoreItem[] };
}

/** "Up to 8 kg", "9 kg", "10.5 – 11 kg". */
export function weightLabel({ from, to }: WeightBand): string {
  if (from === 0) return `Up to ${to} kg`;
  if (from === to) return `${from} kg`;
  return `${from} – ${to} kg`;
}

function row(from: number, to: number, price: number): WeightRow {
  return { from, to, loads: from >= 10 ? 2 : 1, price };
}

const BUBBLY_GAV: PriceGuide = {
  title: 'Wash · Dry · Fold',
  tagline: 'Trusted wash for every home',
  packages: [
    {
      label: 'Package 1',
      tone: 'blue',
      price: 185,
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
      weights: [
        row(0, 8, 185),
        row(8.5, 8.5, 200),
        row(9, 9, 215),
        row(9.5, 9.5, 230),
        row(10, 10, 300),
        row(10.5, 10.5, 315),
        row(11, 11, 330),
      ],
    },
    {
      label: 'Package 2',
      tone: 'green',
      price: 210,
      detergentTitle: 'Liquid detergent',
      detergents: [{ name: 'Ariel', photo: 'ariel' }],
      fabcons: [
        { name: 'Del Gentle Protect', photo: 'del-gentle' },
        { name: 'Del Lavender', photo: 'del-lavender' },
        { name: 'Champion Antibac', photo: 'champion-antibac' },
        { name: 'Personal Collection', photo: 'personal-collection' },
      ],
      weights: [
        row(0, 8, 210),
        row(8.5, 8.5, 225),
        row(9, 9, 240),
        row(9.5, 9.5, 255),
        row(10, 10, 350),
        row(10.5, 11, 365),
        row(11.5, 13.5, 400),
        row(14, 16, 435),
      ],
    },
    {
      label: 'Package 3',
      tone: 'orange',
      price: 240,
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
      weights: [row(0, 8, 240), row(8.1, 8.5, 255), row(9, 9.5, 270), row(10, 16, 480)],
    },
  ],
  loadRules: [
    { icon: 'scale', text: 'Max 8 kg per load — we never overload the machines.' },
    { icon: 'add-circle', text: 'Over 8 kg: +₱15 for every extra ½ kg, +₱30 for every extra 1 kg.' },
    { icon: 'copy', text: '10 kg and up is split into 2 loads for a proper wash and tumble.' },
  ],
  drying: {
    limits: ['Max 8 kg regular clothes', 'Max 4 kg beddings & towels', 'Comforters & duvets per piece'],
    options: [
      {
        name: 'Dry only',
        price: 90,
        points: [
          'Tumble drying gamit ang commercial dryer',
          'Perfect para sa bahagyang basa o napiga nang damit',
        ],
      },
      {
        name: 'Dry + dryer sheet',
        price: 105,
        points: [
          'Commercial dryer drying',
          'May dryer sheets para sa dagdag lambot at bango',
          'Bawas static at wrinkles',
        ],
      },
      {
        name: 'Spin + dry',
        price: 120,
        points: [
          'High-speed spin para matanggal ang sobrang tubig',
          'Mas mabilis at efficient ang drying',
          'Ideal para sa handwashed o mas basang labada',
        ],
      },
      {
        name: 'Spin + dry + dryer sheet',
        price: 135,
        points: [
          'High-speed spin extraction',
          'Commercial dryer drying',
          'May dryer sheets para sa extra freshness at mabangong amoy',
        ],
      },
      {
        name: 'Spin + dry + fold',
        price: 150,
        points: [
          'High-speed spin extraction',
          'Commercial dryer drying',
          'Neatly folded, ready to store or use',
          'May finishing spray para sa bagong-labada feel',
        ],
      },
    ],
  },
  restore: {
    photo: 'sneakers',
    items: [
      {
        name: 'Sneakers',
        icon: 'footsteps',
        blurb: 'Dull sneakers? Muddy shoes? We clean, shine and revive them.',
        tiers: [
          { name: 'Basic cleaning', price: 250 },
          { name: 'Deep cleaning', price: 400 },
        ],
      },
      {
        name: 'Caps',
        icon: 'baseball',
        blurb: 'Your cap deserves spa-like care. Say goodbye to grimy caps.',
        tiers: [
          { name: 'Basic cleaning', price: 150 },
          { name: 'Deep cleaning', price: 300 },
        ],
      },
    ],
  },
};

const GUIDES: Readonly<Record<string, PriceGuide>> = {
  [BUBBLY_GAV_SHOP_ID]: BUBBLY_GAV,
};

/** The shop's own price guide, or null for a shop whose services say it all. */
export function priceGuideFor(shopId: string | null | undefined): PriceGuide | null {
  if (!shopId) return null;
  return GUIDES[shopId] ?? null;
}
