/**
 * The orders board: what the counter sees when it opens the app.
 *
 * A laundry owner's day is three questions — what is late, whose load is done,
 * and who still owes me. The board counts every view so a tile can answer each
 * at a glance, searches by the three things a customer says across the counter
 * (their name, their number, the ticket), and groups history by day so
 * "yesterday's" is a heading rather than a date to decode on every card. The
 * live queue itself is sorted by urgency in `order-queue`.
 */
import { formatMoney } from './money';
import { formatOrderTime } from './order-card';
import { classify, showsUnpaid } from './order-queue';
import { STATUS_LABELS, TERMINAL_STATUSES, type OrderStatus } from './order-status';
import { isClaimedWalkIn, type OrderType, type PaymentStatus } from './order-tags';
import { searchDigits } from './phone';
import type { Fulfillment } from './walk-in-order';

export interface BoardOrder {
  id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  order_type: OrderType;
  fulfillment: Fulfillment;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  estimated_total: number;
  final_total: number | null;
  created_at: string;
  updated_at: string;
  deliver_by: string | null;
}

/**
 * `active` is the whole live queue; the next four are its tiles, each order in
 * exactly one; `collect` is money owed on laundry that is ready or gone.
 */
export type BoardView =
  | 'active'
  | 'overdue'
  | 'working'
  | 'ready'
  | 'stuck'
  | 'collect'
  | 'done'
  | 'all';

export const BOARD_VIEWS: readonly BoardView[] = [
  'active',
  'overdue',
  'working',
  'ready',
  'stuck',
  'collect',
  'done',
  'all',
];

export interface BoardQuery {
  view: BoardView;
  query: string;
}

const isActive = (order: BoardOrder): boolean => !TERMINAL_STATUSES.includes(order.status);
const orderValue = (order: BoardOrder): number => order.final_total ?? order.estimated_total;
const isEstimate = (order: BoardOrder): boolean => (order.final_total ?? null) === null;

function inView(order: BoardOrder, view: BoardView, now: Date): boolean {
  switch (view) {
    case 'active':
      return isActive(order) && classify(order, now) !== 'stuck';
    case 'overdue':
    case 'ready':
    case 'stuck':
      return classify(order, now) === view;
    case 'working': {
      const key = classify(order, now);
      return key === 'working' || key === 'new';
    }
    case 'collect':
      return showsUnpaid(order);
    case 'done':
      return !isActive(order);
    case 'all':
      return true;
  }
}

export function boardCounts(orders: readonly BoardOrder[], now: Date): Record<BoardView, number> {
  const counts: Record<BoardView, number> = {
    active: 0,
    overdue: 0,
    working: 0,
    ready: 0,
    stuck: 0,
    collect: 0,
    done: 0,
    all: 0,
  };
  for (const order of orders) {
    for (const key of BOARD_VIEWS) {
      if (inView(order, key, now)) counts[key] += 1;
    }
  }
  return counts;
}

/** Name, phone digits, or the ticket number — however the owner typed it. */
export function matchesQuery(order: BoardOrder, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (order.customer_name.toLowerCase().includes(needle)) return true;
  const ticket = needle.replace(/^#/, '');
  if (ticket && order.id.toLowerCase().startsWith(ticket)) return true;
  const wanted = searchDigits(needle);
  return wanted.length > 0 && searchDigits(order.customer_phone).includes(wanted);
}

export function boardOrders<T extends BoardOrder>(
  orders: readonly T[],
  board: BoardQuery,
  now: Date
): T[] {
  return orders.filter(
    (order) => inView(order, board.view, now) && matchesQuery(order, board.query)
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY = 86_400_000;

function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayTitle(day: number, now: Date): string {
  const date = new Date(day);
  const daysAgo = Math.round((dayStart(now) - day) / DAY);
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  const named = `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? named : `${named} ${date.getFullYear()}`;
}

export interface DayGroup<T extends BoardOrder> {
  title: string;
  data: T[];
}

/** Sections newest day first; within a day the list keeps the order given. */
export function groupByDay<T extends BoardOrder>(orders: readonly T[], now: Date): DayGroup<T>[] {
  const days = new Map<number, T[]>();
  for (const order of orders) {
    const day = dayStart(new Date(order.created_at));
    days.set(day, [...(days.get(day) ?? []), order]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => b - a)
    .map(([day, data]) => ({ title: dayTitle(day, now), data }));
}

/**
 * What a screen reader says for the whole card. A `Pressable` collapses its
 * children into one node, so without this the badge, the tags and the time
 * were silent — and "unpaid" is the one word the card exists to carry.
 */
export function orderCardLabel(order: BoardOrder, now: Date): string {
  const name = order.customer_name.trim() || 'Unnamed customer';
  const money = `${formatMoney(orderValue(order))}${isEstimate(order) ? ' estimate' : ''}`;
  const payment =
    order.status === 'cancelled' ? '' : order.payment_status === 'paid' ? ', paid' : ', unpaid';
  const source = order.order_type === 'walk_in' ? 'Walk-in' : 'Online';
  const claimed = isClaimedWalkIn(order) ? ', claimed' : '';
  return `${name}, ${money}${payment}. ${STATUS_LABELS[order.status]}. ${source}${claimed}, ${order.fulfillment}. ${formatOrderTime(order.created_at, now)}.`;
}
