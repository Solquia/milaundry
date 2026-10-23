/**
 * Keeps the shop's numbers moving together. The order list is polled by the
 * merchant shell (the doorbell); everything that an order changes — packs
 * left on the shelf, add-on sales, what services and orders cost — used to
 * wait for its own screen to be reopened, so an owner watching from home
 * could see today's sales go up and the stock stay put.
 *
 * Mounted once in the merchant shell, beside the doorbell. When any order is
 * added, paid, edited or cancelled, from any phone or browser, the figures
 * that depend on orders are marked stale and the screens showing them refetch.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { getShopOrders, type OrderWithDetails } from './api';
import { useActiveShop } from './use-active-shop';

/** Every cached figure an order can move. */
const ORDER_DRIVEN_KEYS = [
  'shop-addons',
  'addon-sales',
  'addon-costs',
  'service-costs',
  'period-order-costs',
  'period-supply-use',
] as const;

function signatureOf(orders: readonly OrderWithDetails[]): string {
  return orders
    .map(
      (order) =>
        `${order.id}:${order.status}:${order.payment_status}:${order.final_total ?? order.estimated_total}:${order.order_items?.length ?? 0}`
    )
    .join('|');
}

export function useShopSync(): void {
  const { shop } = useActiveShop();
  const queryClient = useQueryClient();
  const last = useRef<string | null>(null);

  // Reads the doorbell's query from the shared cache; it adds no polling.
  const { data: orders } = useQuery({
    queryKey: ['shop-orders', shop?.id],
    queryFn: () => getShopOrders(shop!.id),
    enabled: Boolean(shop),
  });

  useEffect(() => {
    if (!orders || !shop) return;
    const signature = signatureOf(orders);
    const previous = last.current;
    last.current = signature;
    // The first look is not a change; the screens fetch their own figures.
    if (previous === null || previous === signature) return;
    for (const key of ORDER_DRIVEN_KEYS) {
      void queryClient.invalidateQueries({ queryKey: [key, shop.id] });
    }
  }, [orders, shop, queryClient]);
}
