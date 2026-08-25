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

export const MERCHANT_TABS: readonly TabConfig[] = [
  { name: 'orders', title: 'Orders', icon: 'receipt-outline' },
  { name: 'pos', title: 'POS', icon: 'cart-outline' },
  { name: 'customers', title: 'Customers', icon: 'qr-code', isCenter: true },
  { name: 'analytics', title: 'Analytics', icon: 'stats-chart-outline' },
  { name: 'services', title: 'Services', icon: 'pricetags-outline' },
];

export const CUSTOMER_TABS: readonly TabConfig[] = [
  { name: 'orders', title: 'MiLaundry', icon: 'shirt-outline' },
  { name: 'scan', title: 'Scan', icon: 'qr-code', isCenter: true },
  { name: 'shops', title: 'Shops', icon: 'storefront-outline' },
];

/** Index of the raised tab, or -1 when none is marked. */
export function centerTabIndex(tabs: readonly TabConfig[]): number {
  return tabs.findIndex((tab) => tab.isCenter === true);
}
