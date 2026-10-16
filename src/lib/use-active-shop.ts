import { useQuery } from '@tanstack/react-query';

import { getMyShopMemberships } from './api';
import { useAuth } from './auth';
import { resolveShopRole } from './domain/merchant-access';
import type { ShopAccountRole } from './domain/shop-account';
import { resolveActiveShop } from './domain/view-as-shop';
import { useViewAsShop } from './view-as-shop-context';

// A counter tablet loses Wi-Fi, sleeps, and wakes on a flaky network. The one
// default retry gave up inside a couple of seconds, and the screen then told a
// real merchant their account had no shop. Keep asking a while longer.
const MEMBERSHIP_RETRIES = 5;
const MEMBERSHIP_STALE_MS = 30_000;

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
  /** Asks again — for the "no shop" screen's button. */
  refetch: () => void;
} {
  const { session, profile, isLoading: isAuthLoading } = useAuth();
  const { viewAsShop } = useViewAsShop();
  const isSuperadmin = profile?.role === 'superadmin';
  const userId = session?.user.id;
  const isEnabled = Boolean(userId) && !isSuperadmin;

  const query = useQuery({
    // Keyed by the person: an answer cached for one login must never stand in
    // for the next one on a shared phone.
    queryKey: ['merchant-shops', userId],
    queryFn: () => getMyShopMemberships(userId as string),
    // Superadmins are not shop members; their shop comes from view-as state.
    enabled: isEnabled,
    retry: MEMBERSHIP_RETRIES,
    // "No shop" is the one answer worth doubting, so it is never trusted from
    // cache: every screen that mounts on it asks the database again.
    staleTime: (q) => (q.state.data?.length === 0 ? 0 : MEMBERSHIP_STALE_MS),
  });

  const memberships = query.data ?? [];

  // Belonging to a shop is proof enough of being a merchant. Without this a
  // profile read that failed on a bad network (profile null) made the role
  // read as "customer", and the dashboard showed no shop despite the
  // membership sitting right there.
  const role = profile?.role ?? (memberships.length > 0 ? 'merchant' : 'customer');

  return {
    shop: resolveActiveShop({
      role,
      viewAsShop,
      memberShops: memberships.map((membership) => membership.shop),
    }),
    shopRole: resolveShopRole({
      isSuperadmin,
      membershipRole: memberships[0]?.role,
    }),
    isLoading: isAuthLoading || (isEnabled && query.isPending),
    error: query.error,
    refetch: () => {
      void query.refetch();
    },
  };
}
