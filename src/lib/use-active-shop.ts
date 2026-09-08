import { useQuery } from '@tanstack/react-query';

import { getMyShopMemberships } from './api';
import { useAuth } from './auth';
import { resolveShopRole } from './domain/merchant-access';
import type { ShopAccountRole } from './domain/shop-account';
import { resolveActiveShop } from './domain/view-as-shop';
import { useViewAsShop } from './view-as-shop-context';

// The shop the merchant dashboard operates on: a merchant's first shop
// (v1 operates on one), or the shop a superadmin opened via "view as merchant".
// Also answers what the signed-in person is inside that shop — an owner who
// runs the business, or staff who run the counter — so screens and the tab bar
// can hide what the database would refuse anyway (migration 0021).
export function useActiveShop(): {
  shop: ReturnType<typeof resolveActiveShop>;
  shopRole: ShopAccountRole;
  isLoading: boolean;
  error: Error | null;
} {
  const { profile } = useAuth();
  const { viewAsShop } = useViewAsShop();
  const isSuperadmin = profile?.role === 'superadmin';

  const query = useQuery({
    queryKey: ['merchant-shops'],
    queryFn: getMyShopMemberships,
    // Superadmins are not shop members; their shop comes from view-as state.
    enabled: !isSuperadmin,
  });

  const memberships = query.data ?? [];

  return {
    shop: resolveActiveShop({
      role: profile?.role ?? 'customer',
      viewAsShop,
      memberShops: memberships.map((membership) => membership.shop),
    }),
    shopRole: resolveShopRole({
      isSuperadmin,
      membershipRole: memberships[0]?.role,
    }),
    isLoading: isSuperadmin ? false : query.isLoading,
    error: query.error,
  };
}
