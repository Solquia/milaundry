import {
  OWNER_ONLY_ROUTES,
  canManageShop,
  canOpenMerchantRoute,
  describeShopAccess,
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
