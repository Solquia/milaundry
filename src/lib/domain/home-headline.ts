/**
 * The one line under the wordmark on the customer home.
 *
 * The hero leads with the brand now, so this single sentence carries the whole
 * state: what is happening, where, and how much else there is. It has to read
 * as a sentence rather than as fields joined by dots, because there is no
 * heading above it to give the fragments meaning.
 *
 * The status label arrives pre-resolved, so this stays pure string assembly
 * with no UI dependency.
 */
import { ORDER_STATUSES, type OrderStatus } from './order-status';

export interface HeadlineOrder {
  status: OrderStatus;
  statusLabel: string;
  shopName: string;
}

const NOTHING_IN_THE_WASH = "Book a pickup and we'll collect it from your door.";

/** How far through the cycle a load is. Later in ORDER_STATUSES wins. */
const rank = (status: OrderStatus): number => ORDER_STATUSES.indexOf(status);

/**
 * Which load the screen should speak for, or -1 when there are none.
 *
 * A ready load outranks anything mid-cycle — someone is waiting on it —
 * otherwise the one furthest through the wash wins. The home subline and the
 * shop page's Track card both ask this, so they cannot disagree about which
 * load matters.
 */
export function leadingIndex(orders: readonly { status: OrderStatus }[]): number {
  if (orders.length === 0) return -1;

  const readyAt = orders.findIndex((order) => order.status === 'ready');
  if (readyAt !== -1) return readyAt;

  return orders.reduce(
    (furthest, order, index) =>
      rank(order.status) > rank(orders[furthest].status) ? index : furthest,
    0
  );
}

export function homeSubline(active: readonly HeadlineOrder[]): string {
  if (active.length === 0) return NOTHING_IN_THE_WASH;

  const readyCount = active.filter((order) => order.status === 'ready').length;

  // More than one waiting at the counter: a count is more use than one shop name.
  if (readyCount > 1) return `${readyCount} loads ready for pickup`;

  const leading = active[leadingIndex(active)];
  const line = `${leading.statusLabel} at ${leading.shopName}`;

  return active.length > 1 ? `${line} · +${active.length - 1} more` : line;
}
