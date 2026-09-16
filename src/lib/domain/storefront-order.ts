/**
 * Which of a customer's orders the shop's page speaks for.
 *
 * The band above the price list answers one question — *where is my laundry* —
 * and it has room for one answer. A customer who uses the same shop weekly may
 * have a dozen orders on file, so the choice matters more than it looks.
 *
 * A load still moving through the shop always wins, even over a newer order
 * that has already been collected: a wash running now is the thing the customer
 * came back to the page to check. With nothing live, the last collection still
 * gets to speak, so the band says "Picked up" rather than going blank on
 * someone who has ordered here for a year. A cancelled order says nothing at
 * all — it is not a stage a laundry is at.
 */
import { TERMINAL_STATUSES, type OrderStatus } from './order-status';

/** Everything this needs to know about an order. */
export interface ShopOrderLike {
  id: string;
  shop_id: string;
  status: OrderStatus;
}

/**
 * The order to show, from a list already sorted newest first — which is how
 * `getMyOrders` returns them.
 */
export function orderOnShow<T extends ShopOrderLike>(
  orders: readonly T[],
  shopId: string | null | undefined
): T | null {
  if (!shopId) return null;
  const here = orders.filter((order) => order.shop_id === shopId && order.status !== 'cancelled');
  const live = here.find((order) => !TERMINAL_STATUSES.includes(order.status));
  return live ?? here[0] ?? null;
}
