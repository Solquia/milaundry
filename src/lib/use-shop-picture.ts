/**
 * The owner's whole picture of a period, shared by Sales and full analytics:
 * every order taken with what it used and left (`shop-ledger`), and the shelf
 * and bottles (`shop-stock`). Both screens read the same cache keys as the
 * Prices screen, and the shell's `useShopSync` refreshes them together when
 * an order changes, so no screen can show a number the others have moved on
 * from.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getAddonCosts, getAddonSales, getShopAddons, type OrderWithDetails } from './api';
import { getPeriodOrderCosts, getPeriodSupplyUse } from './cost-api';
import { RECENT_DAYS } from './domain/addon-inventory';
import type { PeriodFrame } from './domain/sales-period';
import { shopLedger, type ShopLedger } from './domain/shop-ledger';
import { shopStock, type ShopStock } from './domain/shop-stock';

export interface ShopPicture {
  ledger: ShopLedger;
  stock: ShopStock;
  /** Order costs have loaded; until then "supplies used" is unknown. */
  hasCosts: boolean;
  isStockLoading: boolean;
}

export function useShopPicture(
  shopId: string | undefined,
  isOwner: boolean,
  orders: readonly OrderWithDetails[],
  frame: PeriodFrame
): ShopPicture {
  const enabled = Boolean(shopId) && isOwner;

  // The orders the ledger costs: refetch when one is added or changes total.
  const ledgerKey = useMemo(
    () =>
      orders
        .filter((order) => {
          const time = new Date(order.created_at).getTime();
          return time >= frame.start && time < frame.end;
        })
        .map((order) => `${order.id}:${order.final_total ?? order.estimated_total}`)
        .join(','),
    [orders, frame.start, frame.end]
  );
  const costs = useQuery({
    queryKey: ['period-order-costs', shopId, frame.start, frame.end, ledgerKey],
    queryFn: () => getPeriodOrderCosts(shopId!, frame.start, frame.end),
    enabled,
    placeholderData: (previous) => previous,
  });
  const addons = useQuery({
    queryKey: ['shop-addons', shopId],
    queryFn: () => getShopAddons(shopId!),
    enabled,
  });
  const addonSales = useQuery({
    queryKey: ['addon-sales', shopId, RECENT_DAYS],
    queryFn: () => getAddonSales(shopId!, RECENT_DAYS),
    enabled,
  });
  const addonCosts = useQuery({
    queryKey: ['addon-costs', shopId, RECENT_DAYS],
    queryFn: () => getAddonCosts(shopId!, RECENT_DAYS),
    enabled,
  });
  const supplyUse = useQuery({
    queryKey: ['period-supply-use', shopId, frame.start, frame.end],
    queryFn: () => getPeriodSupplyUse(shopId!, frame.start, frame.end),
    enabled,
    placeholderData: (previous) => previous,
  });

  const ledger = useMemo(() => shopLedger(orders, costs.data, frame), [orders, costs.data, frame]);
  const stock = useMemo(
    () =>
      shopStock({
        orders,
        addons: addons.data ?? [],
        sales: addonSales.data ?? [],
        costs: addonCosts.data ?? [],
        supplyUse: supplyUse.data ?? [],
        frame,
      }),
    [orders, addons.data, addonSales.data, addonCosts.data, supplyUse.data, frame]
  );

  return {
    ledger,
    stock,
    hasCosts: Boolean(costs.data),
    isStockLoading: addons.isLoading || supplyUse.isLoading,
  };
}
