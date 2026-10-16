/**
 * A shop's loyalty card on its own page, for the customer looking at it.
 *
 * Connected customers see their own stamps and how close the next reward is.
 * Everyone else sees the offer on an empty card: a reason to connect and book
 * here rather than at the shop down the street. Nothing at all when the shop
 * runs no programs.
 */
import { useQuery } from '@tanstack/react-query';
import React from 'react';

import { getMyRewards, getShopRewards } from '@/lib/api';
import type { RewardProgram } from '@/lib/domain/rewards';

import { StampCard } from './stamp-card';

export function ShopRewardsCard({ shopId, isRegistered }: { shopId: string; isRegistered: boolean }) {
  const { data: offer } = useQuery({
    queryKey: ['shop-rewards', shopId],
    queryFn: () => getShopRewards(shopId),
  });
  const { data: mine } = useQuery({
    queryKey: ['my-rewards', shopId],
    queryFn: () => getMyRewards(shopId),
    enabled: isRegistered,
  });

  const standing = mine?.[0] ?? null;
  if (standing && standing.programs.length > 0) {
    return <StampCard programs={standing.programs} standing={standing} />;
  }

  const programs: RewardProgram[] = (offer ?? [])
    .filter((reward) => reward.is_active)
    .map((reward) => ({ ...reward, ready: 0 }));
  const title = isRegistered ? 'Loyalty Rewards' : 'Rewards When You Come Back';
  return <StampCard programs={programs} standing={null} title={title} />;
}
