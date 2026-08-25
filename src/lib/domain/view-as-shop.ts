import type { Role, Shop } from '../types';

// A superadmin can open any shop's merchant dashboard ("view as merchant")
// using their own session; the database grants them the matching access in
// 0007_superadmin_view_as.sql. These rules decide who gets into the merchant
// routes and which shop the dashboard operates on.

export function canEnterMerchantDashboard(
  role: Role,
  hasViewAsShop: boolean
): boolean {
  if (role === 'merchant') return true;
  if (role === 'superadmin') return hasViewAsShop;
  return false;
}

export interface ActiveShopInput {
  role: Role;
  viewAsShop: Shop | null;
  memberShops: Shop[];
}

/**
 * The shop the merchant dashboard operates on: a merchant's first shop
 * (v1 operates on one), or the shop a superadmin chose to view.
 */
export function resolveActiveShop({
  role,
  viewAsShop,
  memberShops,
}: ActiveShopInput): Shop | null {
  if (role === 'superadmin') return viewAsShop;
  if (role === 'merchant') return memberShops[0] ?? null;
  return null;
}

export function viewAsBannerText(shop: Shop): string {
  return `Viewing ${shop.name} as merchant`;
}
