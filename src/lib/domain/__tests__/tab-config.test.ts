import {
  CUSTOMER_TABS,
  MERCHANT_TABS,
  STAFF_TABS,
  centerTabIndex,
  type TabConfig,
} from '../tab-config';

const CONFIGS: { label: string; tabs: readonly TabConfig[] }[] = [
  { label: 'merchant', tabs: MERCHANT_TABS },
  { label: 'customer', tabs: CUSTOMER_TABS },
  { label: 'staff', tabs: STAFF_TABS },
];

describe('tab bar configuration', () => {
  it('lists the merchant tabs in display order', () => {
    expect(MERCHANT_TABS.map((tab) => tab.name)).toEqual([
      'orders',
      'pos',
      'customers',
      'analytics',
      'services',
    ]);
  });

  it('lists the customer tabs in display order', () => {
    expect(CUSTOMER_TABS.map((tab) => tab.name)).toEqual(['orders', 'scan', 'shops']);
  });

  it('lists the staff tabs in display order, with New Order raised', () => {
    expect(STAFF_TABS.map((tab) => tab.name)).toEqual(['orders', 'pos', 'services']);
    expect(STAFF_TABS[centerTabIndex(STAFF_TABS)].name).toBe('pos');
  });

  it('keeps the merchant and staff QR/center buttons on their own icons', () => {
    expect(MERCHANT_TABS[centerTabIndex(MERCHANT_TABS)].icon).toBe('qr-code');
    expect(CUSTOMER_TABS[centerTabIndex(CUSTOMER_TABS)].icon).toBe('qr-code');
  });

  it('names the customer home tab for where it goes, not for the product', () => {
    const home = CUSTOMER_TABS.find((tab) => tab.name === 'orders');
    expect(home?.title).toBe('Home');
  });

  describe.each(CONFIGS)('$label tabs', ({ tabs }) => {
    it('marks exactly one tab as the raised center button', () => {
      expect(tabs.filter((tab) => tab.isCenter)).toHaveLength(1);
    });

    it('places the raised button at the exact middle so it looks centered', () => {
      expect(centerTabIndex(tabs)).toBe(Math.floor(tabs.length / 2));
    });

    it('gives the raised center button a filled glyph', () => {
      const center = tabs[centerTabIndex(tabs)];
      expect(center.icon.endsWith('-outline')).toBe(false);
    });

    it('gives every tab a title and an icon', () => {
      tabs.forEach((tab) => {
        expect(tab.title.length).toBeGreaterThan(0);
        expect(tab.icon.length).toBeGreaterThan(0);
      });
    });

    it('has unique route names', () => {
      const names = tabs.map((tab) => tab.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  it('reports -1 when no tab is marked as the center', () => {
    expect(centerTabIndex([{ name: 'a', title: 'A', icon: 'home' }])).toBe(-1);
  });
});
