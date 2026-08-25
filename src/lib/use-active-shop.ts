import { useQuery } from '@tanstack/react-query';

import { getMyMerchantShops } from './api';
import { useAuth } from './auth';
import { resolveActiveShop } from './domain/view-as-shop';
import { useViewAsShop } from './view-as-shop-context';

// The shop the merchant dashboard operates on: a merchant's first shop
// (v1 operates on one), or the shop a superadmin opened via "view as merchant".
export function useActiveShop() {
  const { profile } = useAuth();
  const { viewAsShop } = useViewAsShop();
  const isSuperadmin = profile?.role === 'superadmin';

  const query = useQuery({
    queryKey: ['merchant-shops'],
    queryFn: getMyMerchantShops,
    // Superadmins are not shop members; their shop comes from view-as state.
    enabled: !isSuperadmin,
  });

  return {
    shop: resolveActiveShop({
      role: profile?.role ?? 'customer',
      viewAsShop,
      memberShops: query.data ?? [],
    }),
    isLoading: isSuperadmin ? false : query.isLoading,
    error: query.error,
  };
}
