/**
 * The customer's notification feed.
 *
 * Nothing here is stored. A laundry order already carries everything a
 * notification would say — where the clothes are, whether the shop has weighed
 * them yet, what is owed — so the feed is derived from the orders the customer
 * can already see rather than kept in a second table that can disagree with
 * them. An order that moves to `drying` *is* the notification.
 *
 * Two things can be true of one load at once: it is drying, and its price has
 * just been confirmed. Those are separate notifications, because one is news
 * and the other is a question, and collapsing them would bury the question.
 */
import type { AppSettings } from './app-settings';
import { bookingPaymentStage } from './booking-status';
import { formatMoney } from './money';
import type { OrderStatus } from './order-status';
import type { OrderType, PaymentStatus } from './order-tags';
import type { Fulfillment } from './walk-in-order';
import { WASH_CYCLE_STAGES } from './wash-cycle';

export interface NotifiableOrder {
  id: string;
  /** Pre-resolved by the screen, so this module stays free of API shapes. */
  shopName: string;
  status: OrderStatus;
  order_type: OrderType;
  fulfillment: Fulfillment;
  payment_status: PaymentStatus;
  estimated_total: number;
  final_total: number | null;
  updated_at: string;
}

export type NotificationKind =
  | 'booked'
  | 'stage'
  | 'ready'
  | 'price_ready'
  | 'completed'
  | 'cancelled';

/**
 * How loud the row is. `action` is the only tone that takes colour, for the
 * same reason blue is rare elsewhere in the app: a feed where every row is
 * urgent has no urgent rows.
 */
export type NotificationTone = 'action' | 'progress' | 'quiet';

export interface LaundryNotification {
  /** Unique across the feed: one order can raise more than one notification. */
  id: string;
  orderId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Ionicons glyph. */
  icon: string;
  tone: NotificationTone;
  /** ISO timestamp of the change this notification reports. */
  at: string;
  /** True when the customer has to do something, not just know something. */
  needsAction: boolean;
}

/** The glyph the tracker already uses for each cycle stage, so the two agree. */
const STAGE_ICONS: Partial<Record<OrderStatus, string>> = Object.fromEntries(
  WASH_CYCLE_STAGES.map((stage) => [stage.status, stage.icon])
);

type Notice = Omit<LaundryNotification, 'id' | 'orderId' | 'at'>;

/**
 * Where the laundry is, said the way the shop would say it over the counter.
 * The tracker's badge labels are deliberately not reused: a badge names a
 * state in two words, a notification says what just happened.
 */
function stageNotice(order: NotifiableOrder): Notice {
  const shop = order.shopName;
  const icon = STAGE_ICONS[order.status] ?? 'ellipse-outline';

  switch (order.status) {
    case 'pending':
      return {
        kind: 'booked',
        title: 'Booking placed',
        body: `${shop} will weigh your laundry and confirm the actual price.`,
        icon: 'calendar-outline',
        tone: 'quiet',
        needsAction: false,
      };
    case 'received':
      return {
        kind: 'stage',
        title: 'In the shop',
        body: `${shop} has your laundry and will start the wash soon.`,
        icon,
        tone: 'progress',
        needsAction: false,
      };
    case 'washing':
      return {
        kind: 'stage',
        title: 'Washing',
        body: `Your load is in the machines at ${shop}.`,
        icon,
        tone: 'progress',
        needsAction: false,
      };
    case 'drying':
      return {
        kind: 'stage',
        title: 'Drying',
        body: `Washed, and now drying at ${shop}.`,
        icon,
        tone: 'progress',
        needsAction: false,
      };
    case 'folded':
      return {
        kind: 'stage',
        title: 'Folded',
        body: `Folded and being packed up at ${shop}.`,
        icon,
        tone: 'progress',
        needsAction: false,
      };
    case 'ready':
      return order.fulfillment === 'delivery'
        ? {
            kind: 'ready',
            title: 'Out for delivery',
            body: `${shop} is bringing your laundry over.`,
            icon: 'bicycle-outline',
            tone: 'action',
            needsAction: true,
          }
        : {
            kind: 'ready',
            title: 'Ready for pickup',
            body: `Your laundry is packed and waiting at ${shop}.`,
            icon,
            tone: 'action',
            needsAction: true,
          };
    case 'completed':
      return {
        kind: 'completed',
        title: 'Order complete',
        body: `${shop} handed your laundry over. Thanks!`,
        icon: 'sparkles-outline',
        tone: 'quiet',
        needsAction: false,
      };
    case 'cancelled':
      return {
        kind: 'cancelled',
        title: 'Cancelled',
        body: `This order at ${shop} was cancelled.`,
        icon: 'close-circle-outline',
        tone: 'quiet',
        needsAction: false,
      };
  }
}

/**
 * The one notification that asks a question. It exists only in the window
 * `bookingPaymentStage` calls `price_confirmed` — weighed, and not yet settled
 * — so a walk-in, a cancelled order, or a paid one never raises it.
 */
function priceNotice(order: NotifiableOrder): Notice | null {
  if (bookingPaymentStage(order) !== 'price_confirmed') return null;

  return {
    kind: 'price_ready',
    title: 'Actual price ready',
    body: `${order.shopName} weighed your laundry: ${formatMoney(
      order.final_total ?? 0
    )}. Choose how you'll pay.`,
    icon: 'cash-outline',
    tone: 'action',
    needsAction: true,
  };
}

/**
 * Sorted by what is owed of the customer first, then by recency. A load that
 * went ready yesterday still outranks one that started washing this morning:
 * the feed is a list of things to do before it is a history.
 */
export function buildNotifications(
  orders: readonly NotifiableOrder[]
): LaundryNotification[] {
  const feed = orders.flatMap((order) => {
    const notices = [priceNotice(order), stageNotice(order)].filter(
      (notice): notice is Notice => notice !== null
    );
    return notices.map((notice) => ({
      ...notice,
      id: `${order.id}:${notice.kind}`,
      orderId: order.id,
      at: order.updated_at,
    }));
  });

  return feed.sort((a, b) => {
    if (a.needsAction !== b.needsAction) return a.needsAction ? -1 : 1;
    return Date.parse(b.at) - Date.parse(a.at);
  });
}

/** Which notification setting, if any, governs a kind of row. */
const MUTABLE_BY: Partial<Record<NotificationKind, keyof AppSettings>> = {
  booked: 'orderUpdates',
  stage: 'orderUpdates',
  completed: 'finishedOrders',
  cancelled: 'finishedOrders',
};

/**
 * The feed with the rows the customer asked not to see removed.
 *
 * Muting is a request for less noise, never a request to be kept in the dark:
 * a row that `needsAction` — a price waiting to be settled, laundry waiting to
 * be collected — survives every setting, because the alternative is an app
 * that quietly hides money owed. That also keeps the number on the bell equal
 * to the number of actionable rows behind it whatever is muted.
 */
export function enabledNotifications(
  notifications: readonly LaundryNotification[],
  settings: AppSettings
): LaundryNotification[] {
  return notifications.filter((notification) => {
    if (notification.needsAction) return true;
    const setting = MUTABLE_BY[notification.kind];
    return setting === undefined || settings[setting];
  });
}

export function actionableCount(
  notifications: readonly LaundryNotification[]
): number {
  return notifications.filter((notification) => notification.needsAction).length;
}

/** Above this the badge would grow into a pill and stop reading as a dot. */
const BADGE_CEILING = 9;

/** What the dot on the bell says; '' when there is no dot to draw. */
export function badgeLabel(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return '';
  const whole = Math.floor(count);
  return whole > BADGE_CEILING ? `${BADGE_CEILING}+` : String(whole);
}

/**
 * What the bell announces. The count belongs in the label rather than only in
 * the dot, since a badge is a visual signal a screen reader gets nothing from.
 */
export function bellLabel(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return 'Notifications';
  const whole = Math.floor(count);
  const verb = whole === 1 ? 'needs' : 'need';
  return `Notifications, ${whole} ${verb} your attention`;
}
