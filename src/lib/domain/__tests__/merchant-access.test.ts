import {
  OWNER_ONLY_ROUTES,
  canManageShop,
  canOpenMerchantRoute,
  describeShopAccess,
  redirectForMerchantScreen,
  resolveShopRole,
  tabsForShopRole,
} from '../merchant-access';
import { MERCHANT_TABS, STAFF_TABS } from '../tab-config';

describe('tabsForShopRole', () => {
  it('gives an owner every merchant tab', () => {
    expect(tabsForShopRole('owner')).toBe(MERCHANT_TABS);
  });

  it('gives staff only orders, new order and prices', () => {
    expect(tabsForShopRole('staff')).toBe(STAFF_TABS);
    expect(STAFF_TABS.map((tab) => tab.name)).toEqual(['orders', 'pos', 'services']);
  });

  it('never shows staff an owner-only tab', () => {
    const names = tabsForShopRole('staff').map((tab) => tab.name);
    OWNER_ONLY_ROUTES.forEach((route) => expect(names).not.toContain(route));
  });
});

describe('canOpenMerchantRoute', () => {
  it('lets an owner open everything', () => {
    ['orders', 'pos', 'services', 'analytics', 'customers', 'settings'].forEach((route) =>
      expect(canOpenMerchantRoute('owner', route)).toBe(true)
    );
  });

  it('keeps staff off earnings and the customer book', () => {
    expect(canOpenMerchantRoute('staff', 'analytics')).toBe(false);
    expect(canOpenMerchantRoute('staff', 'customers')).toBe(false);
  });

  it('lets staff into orders, new order, prices and settings', () => {
    ['orders', 'pos', 'services', 'settings', 'order/[id]'].forEach((route) =>
      expect(canOpenMerchantRoute('staff', route)).toBe(true)
    );
  });
});

describe('canManageShop', () => {
  it('is true only for an owner', () => {
    expect(canManageShop('owner')).toBe(true);
    expect(canManageShop('staff')).toBe(false);
  });
});

describe('resolveShopRole', () => {
  it('treats a superadmin as the owner of the shop they view', () => {
    expect(resolveShopRole({ isSuperadmin: true, membershipRole: null })).toBe('owner');
    expect(resolveShopRole({ isSuperadmin: true, membershipRole: 'staff' })).toBe('owner');
  });

  it('uses the membership role for a merchant', () => {
    expect(resolveShopRole({ isSuperadmin: false, membershipRole: 'owner' })).toBe('owner');
    expect(resolveShopRole({ isSuperadmin: false, membershipRole: 'staff' })).toBe('staff');
  });

  it('falls back to staff while the membership is unknown', () => {
    expect(resolveShopRole({ isSuperadmin: false, membershipRole: null })).toBe('staff');
    expect(resolveShopRole({ isSuperadmin: false, membershipRole: undefined })).toBe('staff');
  });
});

describe('describeShopAccess', () => {
  it('names the owner account plainly', () => {
    expect(describeShopAccess('owner')).toBe('Owner account');
  });

  it('tells staff what their account covers', () => {
    expect(describeShopAccess('staff')).toContain('Staff account');
    expect(describeShopAccess('staff')).toContain('prices');
  });
});

describe('redirectForMerchantScreen', () => {
  it('lets an owner through to every screen in the group', () => {
    for (const screen of ['analytics', 'customers', 'orders', 'pos', 'services']) {
      expect(redirectForMerchantScreen('owner', screen)).toBeNull();
    }
  });

  it('lets staff through to the three screens their tabs already show', () => {
    for (const screen of ['orders', 'pos', 'services']) {
      expect(redirectForMerchantScreen('staff', screen)).toBeNull();
    }
  });

  it('sends staff who asked for the earnings screen back to their own home', () => {
    // Dropping the tab is enough on a phone. The web has an address bar, so
    // a bookmark or a typed path is a second way in, and it used to leave the
    // browser showing /analytics while a different screen was on the page.
    expect(redirectForMerchantScreen('staff', 'analytics')).toBe('/(merchant)/orders');
  });

  it('sends staff who asked for the customer book back too', () => {
    expect(redirectForMerchantScreen('staff', 'customers')).toBe('/(merchant)/orders');
  });

  it('leaves screens outside the tab bar alone, so a ticket still opens', () => {
    // `order/[id]` and `settings` are reachable by design and are not owner-only;
    // a guard that swallowed them would break tapping a ticket.
    expect(redirectForMerchantScreen('staff', 'settings')).toBeNull();
    expect(redirectForMerchantScreen('staff', 'index')).toBeNull();
  });
});
