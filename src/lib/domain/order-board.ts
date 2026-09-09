/**
 * The orders board: what the counter sees when it opens the app.
 *
 * A laundry owner's day is two questions — whose load is done, and who still
 * owes me — and the old list answered both only by scrolling. The board
 * answers them in its headline, counts every view so a chip can say how many
 * are behind it, searches by the three things a customer says across the
 * counter (their name, their number, the ticket), and groups the list by day
 * so "yesterday's" is a heading rather than a date to decode on every card.
 */
import { formatMoney } from './money';
import { formatOrderTime } from './order-card';
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
}

export type BoardView = 'active' | 'ready' | 'unpaid' | 'done' | 'all';

export const BOARD_VIEWS: readonly { key: BoardView; label: string }[] = [
  { key: 'active', label: 'In the shop' },
  { key: 'ready', label: 'Ready' },
  { key: 'unpaid', label: 'Unpaid' },
  { key: 'done', label: 'Done' },
  { key: 'all', label: 'All' },
];

export type SourceKey = 'all' | OrderType;

export const SOURCE_OPTIONS: readonly { key: SourceKey; label: string }[] = [
  { key: 'all', label: 'All sources' },
  { key: 'walk_in', label: 'Walk-in' },
  { key: 'online', label: 'Online' },
];

export interface BoardQuery {
  view: BoardView;
  source: SourceKey;
  query: string;
}

const isActive = (order: BoardOrder): boolean => !TERMINAL_STATUSES.includes(order.status);
const isOwed = (order: BoardOrder): boolean =>
  order.payment_status !== 'paid' && order.status !== 'cancelled';
const orderValue = (order: BoardOrder): number => order.final_total ?? order.estimated_total;
const isEstimate = (order: BoardOrder): boolean => (order.final_total ?? null) === null;

function inView(order: BoardOrder, view: BoardView): boolean {
  switch (view) {
    case 'active':
      return isActive(order);
    case 'ready':
      return order.status === 'ready';
    case 'unpaid':
      return isOwed(order);
    case 'done':
      return !isActive(order);
    case 'all':
      return true;
  }
}

export function boardCounts(orders: readonly BoardOrder[]): Record<BoardView, number> {
  const counts: Record<BoardView, number> = { active: 0, ready: 0, unpaid: 0, done: 0, all: 0 };
  for (const order of orders) {
    for (const { key } of BOARD_VIEWS) {
      if (inView(order, key)) counts[key] += 1;
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

export function boardOrders<T extends BoardOrder>(orders: readonly T[], board: BoardQuery): T[] {
  return orders.filter(
    (order) =>
      inView(order, board.view) &&
      (board.source === 'all' || order.order_type === board.source) &&
      matchesQuery(order, board.query)
  );
}

export interface BoardHeadline {
  inShop: number;
  ready: number;
  toCollect: number;
  title: string;
  detail: string;
}

/** `3 in the shop` / `1 ready for pickup · ₱440.00 to collect`. */
export function boardHeadline(orders: readonly BoardOrder[]): BoardHeadline {
  const inShop = orders.filter(isActive).length;
  const ready = orders.filter((order) => order.status === 'ready').length;
  const toCollect = orders.filter(isOwed).reduce((sum, order) => sum + orderValue(order), 0);

  const clauses: string[] = [];
  if (ready > 0) clauses.push(`${ready} ready for pickup`);
  if (toCollect > 0) clauses.push(`${formatMoney(toCollect)} to collect`);

  return {
    inShop,
    ready,
    toCollect,
    title: inShop === 0 ? 'Nothing in the shop' : `${inShop} in the shop`,
    detail: clauses.length > 0 ? clauses.join(' · ') : 'Everyone has paid',
  };
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
