import type { Shop } from '../../types';
import {
  canEnterMerchantDashboard,
  resolveActiveShop,
  viewAsBannerText,
} from '../view-as-shop';

const shop = (id: string, name: string): Shop =>
  ({ id, name } as unknown as Shop);

describe('canEnterMerchantDashboard', () => {
  it('always admits a merchant', () => {
    expect(canEnterMerchantDashboard('merchant', false)).toBe(true);
    expect(canEnterMerchantDashboard('merchant', true)).toBe(true);
  });

  it('admits a superadmin only while viewing a shop as merchant', () => {
    expect(canEnterMerchantDashboard('superadmin', true)).toBe(true);
    expect(canEnterMerchantDashboard('superadmin', false)).toBe(false);
  });

  it('never admits a customer', () => {
    expect(canEnterMerchantDashboard('customer', false)).toBe(false);
    expect(canEnterMerchantDashboard('customer', true)).toBe(false);
  });
});

describe('resolveActiveShop', () => {
  const own = shop('own-1', 'My Wash');
  const viewed = shop('viewed-1', 'Sparkle Wash');

  it('gives a superadmin the shop they chose to view', () => {
    expect(
      resolveActiveShop({ role: 'superadmin', viewAsShop: viewed, memberShops: [] })
    ).toBe(viewed);
  });

  it('gives a superadmin nothing when no shop is being viewed', () => {
    expect(
      resolveActiveShop({ role: 'superadmin', viewAsShop: null, memberShops: [own] })
    ).toBeNull();
  });

  it('gives a merchant their first shop and ignores any view-as state', () => {
    expect(
      resolveActiveShop({ role: 'merchant', viewAsShop: viewed, memberShops: [own] })
    ).toBe(own);
  });

  it('gives a merchant with no shops nothing', () => {
    expect(
      resolveActiveShop({ role: 'merchant', viewAsShop: null, memberShops: [] })
    ).toBeNull();
  });

  it('gives a customer nothing', () => {
    expect(
      resolveActiveShop({ role: 'customer', viewAsShop: viewed, memberShops: [own] })
    ).toBeNull();
  });
});

describe('viewAsBannerText', () => {
  it('names the shop being viewed', () => {
    expect(viewAsBannerText(shop('s1', 'Sparkle Wash'))).toBe(
      'Viewing Sparkle Wash as merchant'
    );
  });
});
