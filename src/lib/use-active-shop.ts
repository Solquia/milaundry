import { useQuery } from '@tanstack/react-query';

import { getMyMerchantShops } from './api';

// A merchant may belong to several shops; v1 operates on the first one.
export function useActiveShop() {
  const query = useQuery({
    queryKey: ['merchant-shops'],
    queryFn: getMyMerchantShops,
  });
  return {
    shop: query.data?.[0] ?? null,
    isLoading: query.isLoading,
    error: query.error,
  };
}
