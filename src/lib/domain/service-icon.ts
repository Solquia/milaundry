/**
 * The glyph on one line of a shop's price list.
 *
 * The storefront used to draw `categoryIcon` on every row, which meant the icon
 * described the *bucket* rather than the service. A shop with three bedding
 * services printed the same bed three times, so the icons carried no
 * information and the column read as decoration — the reason icons came off the
 * rows in the first place.
 *
 * A service's name is the only thing that distinguishes it from its neighbours,
 * so the name is what gets read. The category stays as the fallback, because
 * owners type their own service names and an unrecognised one still needs a
 * glyph.
 *
 * Order matters more than the list length. "Wash, Dry & Fold" contains all
 * three words and "Dry cleaning" contains "dry"; the rules are sorted so the
 * most specific reading wins, and the tests pin exactly those collisions.
 */
import type { ServiceCategory } from './service-catalog';
import { categoryIcon } from './shop-home';

interface IconRule {
  /** Matched against the lowercased service name. */
  keywords: readonly string[];
  icon: string;
}

const RULES: readonly IconRule[] = [
  // Before any "dry" rule: dry cleaning is the most delicate thing the shop
  // handles, and a dryer's sun on a gown would be plainly wrong.
  {
    keywords: ['dry clean', 'dryclean', 'barong', 'suit', 'gown', 'formal'],
    icon: 'sparkles-outline',
  },
  // Before the wash rules: a service that presses is a pressing service, even
  // when the shop washes it first.
  { keywords: ['iron', 'press', 'plantsa'], icon: 'flame-outline' },
  {
    keywords: [
      'comforter',
      'blanket',
      'duvet',
      'bed sheet',
      'bedsheet',
      'bedding',
      'pillow',
      'kumot',
    ],
    icon: 'bed-outline',
  },
  { keywords: ['curtain', 'drape'], icon: 'layers-outline' },
  { keywords: ['shoe', 'sneaker'], icon: 'footsteps-outline' },
  { keywords: ['bag', 'luggage', 'backpack'], icon: 'bag-handle-outline' },
  { keywords: ['towel'], icon: 'browsers-outline' },
  // What the customer hands over is a bag of clothes, so the fold outranks the
  // machinery named beside it.
  { keywords: ['fold', 'labada', 'garment', 'clothes'], icon: 'shirt-outline' },
  { keywords: ['wash', 'laba'], icon: 'water-outline' },
  { keywords: ['dry', 'tuyo'], icon: 'sunny-outline' },
];

export function serviceIcon(name: string, category: ServiceCategory): string {
  const haystack = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) return rule.icon;
  }
  return categoryIcon(category);
}
