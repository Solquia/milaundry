/**
 * How a shop's page looks and books, as the owner chose it.
 *
 * Every shop used to wear one shopfront: a cover photo, a menu of services,
 * and one service booked at a time. That suits a counter people already know.
 * A shop that sells online the way customers already shop online — a grid of
 * products, a basket, one checkout — can switch to the market instead. The
 * choice lives on the shop row (migration 0036); nothing here decides which is
 * better, only how to read the choice safely.
 */

export const STOREFRONT_STYLES = ['classic', 'market'] as const;
export type StorefrontStyle = (typeof STOREFRONT_STYLES)[number];

/** A shop that never chose keeps the page it always had. */
export const DEFAULT_STOREFRONT_STYLE: StorefrontStyle = 'classic';

export function isStorefrontStyle(value: unknown): value is StorefrontStyle {
  return typeof value === 'string' && (STOREFRONT_STYLES as readonly string[]).includes(value);
}

/**
 * The style to draw. An unknown value — a style added by a newer build, or a
 * reply from before the column existed — reads as the classic page rather than
 * as a guess, the same way `resolveAccent` degrades a stale colour.
 */
export function readStorefrontStyle(value: unknown): StorefrontStyle {
  return isStorefrontStyle(value) ? value : DEFAULT_STOREFRONT_STYLE;
}

export interface StorefrontStyleOption {
  key: StorefrontStyle;
  title: string;
  /** One line under the title. */
  detail: string;
  /** What a customer will see, in the order they meet it. */
  points: readonly string[];
}

/** What the owner chooses between, classic first because it is the default. */
export const STOREFRONT_STYLE_OPTIONS: readonly StorefrontStyleOption[] = [
  {
    key: 'classic',
    title: 'Shopfront',
    detail: 'Your cover photo up top, a menu of services below.',
    points: ['Big cover and logo', 'Services as a menu', 'One service per booking'],
  },
  {
    key: 'market',
    title: 'Market',
    detail: 'Browse, add to basket, check out once.',
    points: ['Product grid with + buttons', 'Category chips and search', 'Basket bar and one checkout'],
  },
];
