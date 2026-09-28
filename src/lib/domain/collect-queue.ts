/**
 * Money still owed, split by whether anyone can do anything about it yet.
 *
 * The old "Still to collect" lumped a load still in the drum with a bag that
 * has sat on the shelf for a week. Only laundry that is ready (or already
 * handed over) can be chased; the rest is normal pay-at-pickup. So the queue
 * has three lanes, and only the first two get a button.
 */
import { formatMoney } from './money';
import { orderContact, type ContactableOrder } from './order-contact';
import type { OrderStatus } from './order-status';
import type { PaymentStatus } from './order-tags';

/** Ready or handed over this long without payment: time for a reminder. */
export const OVERDUE_AFTER_DAYS = 3;

const DAY = 86_400_000;

export interface CollectOrder extends ContactableOrder {
  id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  estimated_total: number;
  final_total: number | null;
  created_at: string;
  /** Touched on every status change: when it became ready, near enough. */
  updated_at: string;
}

export interface CollectLane<T extends CollectOrder> {
  count: number;
  amount: number;
  orders: T[];
}

export interface CollectSplit<T extends CollectOrder> {
  /** Ready or handed over, unpaid, still recent. */
  ready: CollectLane<T>;
  /** Ready or handed over, unpaid for OVERDUE_AFTER_DAYS or more: nudge them. */
  overdue: CollectLane<T>;
  /** Still in the machines: paying at pickup is normal, nothing to chase. */
  washing: CollectLane<T>;
}

const valueOf = (order: CollectOrder): number => order.final_total ?? order.estimated_total;
const touched = (order: CollectOrder): number => new Date(order.updated_at).getTime();
const isChaseable = (order: CollectOrder): boolean => order.status === 'ready' || order.status === 'completed';

function lane<T extends CollectOrder>(orders: T[]): CollectLane<T> {
  const sorted = [...orders].sort((a, b) => touched(a) - touched(b));
  const amount = sorted.reduce((sum, order) => sum + valueOf(order), 0);
  return { count: sorted.length, amount: Math.round(amount * 100) / 100, orders: sorted };
}

export function splitCollect<T extends CollectOrder>(orders: readonly T[], now: Date): CollectSplit<T> {
  const owed = orders.filter((order) => order.payment_status !== 'paid' && order.status !== 'cancelled');
  const overdueBefore = now.getTime() - OVERDUE_AFTER_DAYS * DAY;
  return {
    ready: lane(owed.filter((order) => isChaseable(order) && touched(order) > overdueBefore)),
    overdue: lane(owed.filter((order) => isChaseable(order) && touched(order) <= overdueBefore)),
    washing: lane(owed.filter((order) => !isChaseable(order))),
  };
}

export interface NudgeShop {
  name: string;
  gcash_number?: string | null;
  gcash_name?: string | null;
}

/** A friendly, specific reminder: whose laundry, how much, and how to pay. */
export function nudgeMessage(order: CollectOrder, shop: NudgeShop): string {
  const contact = orderContact(order);
  const hello = `Hi ${contact.isNamed ? contact.name : 'there'}!`;
  const amount = formatMoney(valueOf(order));
  const body =
    order.status === 'ready'
      ? `Your laundry at ${shop.name} is ready for pickup. The total is ${amount}.`
      : `Friendly reminder from ${shop.name}: ${amount} for your laundry is still unpaid.`;
  const number = shop.gcash_number?.trim();
  const payee = shop.gcash_name?.trim();
  const pay = number ? ` You can pay by GCash ${number}${payee ? ` (${payee})` : ''}.` : '';
  return `${hello} ${body}${pay} Salamat!`;
}

/** iOS reads the body after `&`, everything else after `?`. */
export function smsLink(phone: string, body: string, platform: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  const joiner = platform === 'ios' ? '&' : '?';
  return `sms:${digits}${joiner}body=${encodeURIComponent(body)}`;
}