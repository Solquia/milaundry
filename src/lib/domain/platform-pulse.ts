/**
 * The superadmin's read of the whole platform, from one bounded fetch of recent
 * orders. Counting shop rows tells an operator nothing they can act on; what
 * they need is whether laundry is moving, where it is moving, and which shops
 * have gone silent.
 */

const DAY_MS = 86_400_000;
const WEEK_DAYS = 7;
/** How far back the console fetches orders. Also the "silent" horizon. */
export const PULSE_WINDOW_DAYS = 28;
/** A shop younger than this is still setting up, not quiet. */
const GRACE_DAYS = 7;

export interface PulseShop {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface PulseOrder {
  shop_id: string;
  status: string;
  estimated_total: number;
  final_total: number | null;
  created_at: string;
}

export interface ShopActivity {
  ordersThisWeek: number;
  /** Newest order inside the window; null when there is none. */
  lastOrderAt: string | null;
}

export interface AttentionItem {
  shopId: string;
  reason: 'quiet' | 'inactive';
}

export interface Leader {
  shopId: string;
  orders: number;
}

export interface PlatformPulse {
  ordersThisWeek: number;
  ordersLastWeek: number;
  revenueThisWeek: number;
  /** Orders per day for the last seven days, oldest first, today last. */
  dailyOrders: number[];
  liveShops: number;
  activityByShop: Record<string, ShopActivity>;
  attention: AttentionItem[];
  leaders: Leader[];
}

function ageInDays(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / DAY_MS;
}

function orderValue(order: PulseOrder): number {
  return Number(order.final_total ?? order.estimated_total) || 0;
}

function emptyActivity(shops: readonly PulseShop[]): Record<string, ShopActivity> {
  return Object.fromEntries(
    shops.map((shop) => [shop.id, { ordersThisWeek: 0, lastOrderAt: null }])
  );
}

function attentionFor(
  shops: readonly PulseShop[],
  activity: Record<string, ShopActivity>,
  now: Date
): AttentionItem[] {
  const quiet = shops
    .filter(
      (shop) =>
        shop.is_active &&
        ageInDays(shop.created_at, now) >= GRACE_DAYS &&
        (activity[shop.id]?.ordersThisWeek ?? 0) === 0
    )
    .map((shop) => ({ shopId: shop.id, reason: 'quiet' as const }));
  const inactive = shops
    .filter((shop) => !shop.is_active)
    .map((shop) => ({ shopId: shop.id, reason: 'inactive' as const }));
  return [...quiet, ...inactive];
}

export function platformPulse(
  shops: readonly PulseShop[],
  orders: readonly PulseOrder[],
  now: Date = new Date()
): PlatformPulse {
  const dailyOrders = Array.from({ length: WEEK_DAYS }, () => 0);
  const activity = emptyActivity(shops);
  let ordersThisWeek = 0;
  let ordersLastWeek = 0;
  let revenueThisWeek = 0;

  for (const order of orders) {
    const age = ageInDays(order.created_at, now);
    if (age < 0 || age >= PULSE_WINDOW_DAYS) continue;

    const current = activity[order.shop_id] ?? { ordersThisWeek: 0, lastOrderAt: null };
    const isNewer = !current.lastOrderAt || order.created_at > current.lastOrderAt;
    const isThisWeek = age < WEEK_DAYS;
    activity[order.shop_id] = {
      ordersThisWeek: current.ordersThisWeek + (isThisWeek ? 1 : 0),
      lastOrderAt: isNewer ? order.created_at : current.lastOrderAt,
    };

    if (isThisWeek) {
      ordersThisWeek += 1;
      dailyOrders[WEEK_DAYS - 1 - Math.floor(age)] += 1;
      if (order.status !== 'cancelled') revenueThisWeek += orderValue(order);
    } else if (age < WEEK_DAYS * 2) {
      ordersLastWeek += 1;
    }
  }

  const leaders = shops
    .map((shop) => ({ shopId: shop.id, orders: activity[shop.id]?.ordersThisWeek ?? 0 }))
    .filter((leader) => leader.orders > 0)
    .sort((a, b) => b.orders - a.orders);

  return {
    ordersThisWeek,
    ordersLastWeek,
    revenueThisWeek: Math.round(revenueThisWeek * 100) / 100,
    dailyOrders,
    liveShops: shops.filter((shop) => shop.is_active).length,
    activityByShop: activity,
    attention: attentionFor(shops, activity, now),
    leaders,
  };
}

/** One line under a shop's name saying how it is doing. */
export function shopActivityLine(activity: ShopActivity, now: Date = new Date()): string {
  if (activity.ordersThisWeek > 0) {
    const noun = activity.ordersThisWeek === 1 ? 'order' : 'orders';
    return `${activity.ordersThisWeek} ${noun} this week`;
  }
  if (!activity.lastOrderAt) return `No orders in ${PULSE_WINDOW_DAYS / WEEK_DAYS} weeks`;
  const days = Math.floor(ageInDays(activity.lastOrderAt, now));
  return `Last order ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** "+40%" / "−12%" / "New" week-over-week, or null when there is nothing to compare. */
export function weekDelta(thisWeek: number, lastWeek: number): string | null {
  if (lastWeek === 0) return thisWeek > 0 ? 'New' : null;
  const change = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  if (change === 0) return 'Flat';
  return change > 0 ? `+${change}%` : `−${Math.abs(change)}%`;
}
