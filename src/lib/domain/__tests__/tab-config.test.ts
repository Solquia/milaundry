import {
  CUSTOMER_TABS,
  MERCHANT_TABS,
  centerTabIndex,
  type TabConfig,
} from '../tab-config';

const CONFIGS: { label: string; tabs: readonly TabConfig[] }[] = [
  { label: 'merchant', tabs: MERCHANT_TABS },
  { label: 'customer', tabs: CUSTOMER_TABS },
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

  describe.each(CONFIGS)('$label tabs', ({ tabs }) => {
    it('marks exactly one tab as the raised center button', () => {
      expect(tabs.filter((tab) => tab.isCenter)).toHaveLength(1);
    });

    it('places the raised button at the exact middle so it looks centered', () => {
      expect(centerTabIndex(tabs)).toBe(Math.floor(tabs.length / 2));
    });

    it('uses a QR icon for the raised center button', () => {
      const center = tabs[centerTabIndex(tabs)];
      expect(center.icon).toBe('qr-code');
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
