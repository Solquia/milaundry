/**
 * The queries that draw a shop, and how to refresh them after the shop changes.
 *
 * A merchant's save used to invalidate `['active-shop']`, a key no query has
 * ever registered, so nothing refetched: the merchant preview looked right only
 * because it showed the local file just picked, and the customer surfaces kept
 * the old row until their staleTime lapsed. These are the real keys.
 */
import type { QueryClient } from '@tanstack/react-query';

import type { Shop } from './types';

/**
 * Refreshes every surface that draws this shop, merchant and customer alike.
 * When the save returned the new row it is written into the shopfront's query
 * first, so a superadmin viewing as the shop (whose `shop` comes from context,
 * not a query) sees the change on the very next render.
 */
export async function invalidateShopSurfaces(
  queryClient: QueryClient,
  shopId: string,
  updated?: Shop
): Promise<void> {
  if (updated) queryClient.setQueryData(['shop', shopId], updated);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['merchant-shops'] }),
    queryClient.invalidateQueries({ queryKey: ['shop', shopId] }),
    queryClient.invalidateQueries({ queryKey: ['registered-shops'] }),
    queryClient.invalidateQueries({ queryKey: ['visible-shops'] }),
  ]);
}
