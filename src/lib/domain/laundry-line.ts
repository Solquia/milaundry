/**
 * Loads on the go, in as few words as a glance takes.
 *
 * Each load is two short lines: where it is (one word), and how much and
 * when it is back. Nothing is said twice, and nothing is said as filler — a
 * load with no promised time says nothing rather than "we'll tell you".
 *
 * Times are read on the shop's clock (`rider-calendar`), so "tomorrow" means
 * the shop's tomorrow wherever the phone happens to be.
 */
import { formatMoneyCompact } from './money';
import type { PaymentStatus } from './order-tags';
import type { OrderStatus } from './order-status';
import { lineQuantity } from './price-label';
import type { PricingUnit } from './pricing';
import {
  DEFAULT_SHOP_HOURS,
  daysBetween,
  shopToday,
  timeText,
  weekdayOf,
  type DayKey,
  type ShopHours,
} from './rider-calendar';
import { WASH_CYCLE_STAGES } from './wash-cycle';
import type { Fulfillment } from './walk-in-order';

export interface LineItem {
  service_name: string;
  unit: PricingUnit;
  quantity: number;
}

/** What a line reads off an order, and nothing else. */
export interface LineOrder {
  id: string;
  status: OrderStatus;
  fulfillment: Fulfillment;
  pickup_at: string | null;
  deliver_by: string | null;
  estimated_total: number;
  final_total: number | null;
  payment_status: PaymentStatus;
  created_at: string;
  order_items: readonly LineItem[];
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;
/** Within a week the weekday is enough; past that it needs its date. */
const WEEK = 6;

/** `8.5 kg`, `8.5 kg +1`. How much — the shop's logo already says where. */
export function loadSize(items: readonly LineItem[]): string {
  if (items.length === 0) return '';
  const [main, ...rest] = items;
  const size = lineQuantity(main.unit, main.quantity) ?? 'Flat rate';
  return rest.length > 0 ? `${size} +${rest.length}` : size;
}

const STATUS_WORDS: Record<OrderStatus, string> = {
  pending: 'Booked',
  received: 'In the shop',
  washing: 'Washing',
  drying: 'Drying',
  folded: 'Folded',
  ready: 'Ready',
  completed: 'Done',
  cancelled: 'Cancelled',
};

/** One word for where it is. */
export function statusWord(status: OrderStatus): string {
  return STATUS_WORDS[status];
}

/** How full the ring around the shop's logo is: a fifth per stage the load has reached. */
export function ringProgress(status: OrderStatus): number {
  if (status === 'completed') return 1;
  const index = WASH_CYCLE_STAGES.findIndex((stage) => stage.status === status);
  return index < 0 ? 0 : (index + 1) / WASH_CYCLE_STAGES.length;
}

/** An instant on the shop's clock: the day, and the time as said aloud. */
function shopMoment(iso: string, hours: ShopHours): { day: DayKey; time: string } {
  const wall = new Date(new Date(iso).getTime() + hours.utcOffsetMinutes * 60 * 1000);
  const m = String(wall.getUTCMonth() + 1).padStart(2, '0');
  const d = String(wall.getUTCDate()).padStart(2, '0');
  return {
    day: `${wall.getUTCFullYear()}-${m}-${d}`,
    time: timeText(wall.getUTCHours(), wall.getUTCMinutes()),
  };
}

/** `today`, `tomorrow`, `yesterday`, `Sat`, or `Mon 5 Oct` — as it sits in a sentence. */
function spokenDay(day: DayKey, today: DayKey): string {
  const offset = daysBetween(today, day);
  if (offset === 0) return 'today';
  if (offset === 1) return 'tomorrow';
  if (offset === -1) return 'yesterday';
  const weekday = WEEKDAYS[weekdayOf(day)];
  if (offset > 0 && offset <= WEEK) return weekday;
  const [, month, date] = day.split('-').map(Number);
  return `${weekday} ${date} ${MONTHS[month - 1]}`;
}

export type LineTone = 'normal' | 'late' | 'ready';

export interface WhenLine {
  text: string;
  tone: LineTone;
}

const QUIET: WhenLine = { text: '', tone: 'normal' };

/** When the next thing happens: `Back tomorrow 6 PM`, `Pickup today 4 PM`. Empty when unknown. */
export function whenLine(
  order: LineOrder,
  now: Date,
  hours: ShopHours = DEFAULT_SHOP_HOURS
): WhenLine {
  const today = shopToday(now, hours);
  const isRider = order.fulfillment === 'delivery';
  const at = (iso: string) => {
    const moment = shopMoment(iso, hours);
    return `${spokenDay(moment.day, today)} ${moment.time}`;
  };
  const isPast = (iso: string) => new Date(iso).getTime() < now.getTime();

  switch (order.status) {
    case 'completed':
      return { text: isRider ? 'Delivered' : 'Collected', tone: 'normal' };
    case 'cancelled':
      return QUIET;
    case 'ready':
      if (!isRider) return { text: 'Collect at the shop', tone: 'ready' };
      return {
        text:
          order.deliver_by && !isPast(order.deliver_by)
            ? `Arrives ${at(order.deliver_by)}`
            : 'On its way',
        tone: 'ready',
      };
    case 'pending':
      if (!isRider) return { text: 'Drop off at the shop', tone: 'normal' };
      return order.pickup_at ? { text: `Pickup ${at(order.pickup_at)}`, tone: 'normal' } : QUIET;
    default:
      if (!order.deliver_by) return QUIET;
      return isPast(order.deliver_by)
        ? { text: `Late · due ${at(order.deliver_by)}`, tone: 'late' }
        : { text: `Back ${at(order.deliver_by)}`, tone: 'normal' };
  }
}

export type MoneyKind = 'estimate' | 'due' | 'paid';

/** A guess rounded to the peso with a tilde; a weighed bill as it stands. */
export function moneyLabel(order: LineOrder): { text: string; kind: MoneyKind } {
  if (order.final_total === null) {
    return { text: `~${formatMoneyCompact(Math.round(order.estimated_total))}`, kind: 'estimate' };
  }
  return {
    text: formatMoneyCompact(order.final_total),
    kind: order.payment_status === 'paid' ? 'paid' : 'due',
  };
}

/** Ready first, finished and cancelled last, everything still moving between. */
function rankOf(status: OrderStatus): number {
  if (status === 'ready') return 0;
  if (status === 'completed' || status === 'cancelled') return 2;
  return 1;
}

function nextAt(order: LineOrder): number {
  const iso = order.deliver_by ?? order.pickup_at;
  return iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY;
}

/**
 * By what happens next, not by when it was booked: whatever is ready leads,
 * then whatever is due back soonest, then anything with no time at all. A new
 * copy; the list given is untouched.
 */
export function sortByNext<T extends LineOrder>(orders: readonly T[]): T[] {
  return [...orders].sort((a, b) => {
    const rank = rankOf(a.status) - rankOf(b.status);
    if (rank !== 0) return rank;
    // Finished loads read newest first, like any history.
    if (rankOf(a.status) === 2) return b.created_at.localeCompare(a.created_at);
    const aAt = nextAt(a);
    const bAt = nextAt(b);
    if (aAt !== bAt) {
      if (!Number.isFinite(aAt)) return 1;
      if (!Number.isFinite(bAt)) return -1;
      return aAt - bAt;
    }
    return b.created_at.localeCompare(a.created_at);
  });
}
