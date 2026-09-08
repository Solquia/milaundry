import type { ShopAccountRole } from './shop-account';
import { MERCHANT_TABS, STAFF_TABS, type TabConfig } from './tab-config';

/**
 * What a login inside a shop is allowed to open.
 *
 * An owner runs the business: earnings, the customer book, and every shop
 * setting. Staff run the counter: the orders coming in, a new walk-in order,
 * and the price list. Nothing here is the security boundary — the database
 * refuses the owner-only calls to a staff session (migration 0021) — but the
 * screens a person cannot use should not be on their tab bar either.
 */

/** Route file names inside (merchant) that only an owner may open. */
export const OWNER_ONLY_ROUTES: readonly string[] = ['analytics', 'customers'];

/** The tab bar for a member of this role. */
export function tabsForShopRole(role: ShopAccountRole): readonly TabConfig[] {
  return role === 'owner' ? MERCHANT_TABS : STAFF_TABS;
}

/** Whether this role may open the given (merchant) route. */
export function canOpenMerchantRoute(role: ShopAccountRole, routeName: string): boolean {
  if (role === 'owner') return true;
  return !OWNER_ONLY_ROUTES.includes(routeName);
}

/** Earnings, the customer book, and the shop's own settings cards. */
export function canManageShop(role: ShopAccountRole): boolean {
  return role === 'owner';
}

/**
 * The role the dashboard should treat the signed-in person as. A superadmin
 * viewing a shop is an owner of it for the duration; a merchant is whatever
 * their membership says; a membership that has not loaded yet is treated as
 * staff so nothing owner-only flashes before the answer arrives.
 */
export function resolveShopRole(input: {
  isSuperadmin: boolean;
  membershipRole: ShopAccountRole | null | undefined;
}): ShopAccountRole {
  if (input.isSuperadmin) return 'owner';
  return input.membershipRole ?? 'staff';
}

/** One line under the account name on the settings screen. */
export function describeShopAccess(role: ShopAccountRole): string {
  return role === 'owner'
    ? 'Owner account'
    : 'Staff account · orders, new orders and prices';
}
