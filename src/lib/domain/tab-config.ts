/**
 * Bottom tab bar definitions. The tab flagged `isCenter` is drawn as a raised
 * circular button, so it must sit at the exact middle of the row.
 */
export interface TabConfig {
  /** Route file name inside the (merchant)/(customer) group. */
  name: string;
  title: string;
  /** Ionicons glyph name. */
  icon: string;
  isCenter?: boolean;
}

/**
 * Titles are the words a laundry owner already says out loud. "POS",
 * "Analytics" and "Services" are retail-software vocabulary; they sat in the
 * tab bar, on every screen, asking the least technical person in the shop to
 * translate before they could navigate. Route names are unchanged, so no file
 * or link moves.
 */
export const MERCHANT_TABS: readonly TabConfig[] = [
  { name: 'orders', title: 'Orders', icon: 'receipt-outline' },
  { name: 'pos', title: 'New Order', icon: 'cart-outline' },
  { name: 'customers', title: 'Customers', icon: 'qr-code', isCenter: true },
  { name: 'analytics', title: 'Earnings', icon: 'stats-chart-outline' },
  { name: 'services', title: 'Prices', icon: 'pricetags-outline' },
];

/**
 * What a staff login sees: the orders coming in, a new walk-in order, and the
 * price list. Earnings and the customer book are the owner's. "New Order" is
 * the raised button because it is the one thing staff do most.
 */
export const STAFF_TABS: readonly TabConfig[] = [
  { name: 'orders', title: 'Orders', icon: 'receipt-outline' },
  { name: 'pos', title: 'New Order', icon: 'cart', isCenter: true },
  { name: 'services', title: 'Prices', icon: 'pricetags-outline' },
];

/**
 * The customer's own bar. The home tab used to carry the product's name, which
 * put "MiLaundry" on screen at all times and told the customer nothing: they
 * know which app they opened. It says where the tab goes instead.
 */
export const CUSTOMER_TABS: readonly TabConfig[] = [
  { name: 'orders', title: 'Home', icon: 'shirt-outline' },
  { name: 'scan', title: 'Scan', icon: 'qr-code', isCenter: true },
  { name: 'shops', title: 'Shops', icon: 'storefront-outline' },
];

/** Index of the raised tab, or -1 when none is marked. */
export function centerTabIndex(tabs: readonly TabConfig[]): number {
  return tabs.findIndex((tab) => tab.isCenter === true);
}
