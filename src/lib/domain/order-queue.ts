/**
 * The counter's queue: what to do next, not what came in last.
 *
 * A laundry works a queue, sorted by urgency: what has overrun, who is waiting
 * at the counter, what is in the machines, what has not been touched.
 *
 * "Overdue" is measured per stage from the order's last change, because a load
 * that has been washing for fourteen hours is a problem and one that was
 * dropped off fourteen hours ago is not. An order nobody has touched for a week
 * is not overdue at all — it is *stuck*: forgotten in the app, or abandoned by
 * its customer — and the fix for it is a phone call or a cancel, not the next
 * wash step. Stuck orders sit apart so they cannot turn the whole queue red.
 */
import type { ConfirmPrompt } from './confirm-prompts';
import { formatOrderTime, shortOrderId } from './order-card';
import { orderContact, type ContactableOrder } from './order-contact';
import { TERMINAL_STATUSES, type OrderStatus } from './order-status';
import type { PaymentStatus } from './order-tags';
import type { Fulfillment } from './walk-in-order';

export interface QueueOrder extends ContactableOrder {
  id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  fulfillment: Fulfillment;
  estimated_total: number;
  final_total: number | null;
  created_at: string;
  /** Touched by the database on every change: the moment this stage began, near enough. */
  updated_at: string;
  /** The promised time back; null for a self drop-off. */
  deliver_by: string | null;
}

/** How long each moving stage may run before the order is overdue. */
export const STAGE_LIMIT_HOURS: Readonly<Partial<Record<OrderStatus, number>>> = {
  pending: 24,
  received: 24,
  washing: 12,
  drying: 12,
  folded: 24,
};

/** A week with no change: nobody is working this order any more. */
export const STUCK_AFTER_DAYS = 7;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The stage in the counter's own words, short enough for the second line of a row. */
const STAGE_WORDS: Record<OrderStatus, string> = {
  pending: 'Booked',
  received: 'Dropped off',
  washing: 'Washing',
  drying: 'Drying',
  folded: 'Folded',
  ready: 'Ready',
  completed: 'Handed over',
  cancelled: 'Cancelled',
};

const isOver = (order: QueueOrder): boolean => TERMINAL_STATUSES.includes(order.status);
const idleFor = (order: QueueOrder, now: Date): number =>
  now.getTime() - new Date(order.updated_at).getTime();

/** When this order runs out of time: its promise, or its stage limit, whichever comes first. */
function deadline(order: QueueOrder): number {
  const limit = STAGE_LIMIT_HOURS[order.status];
  const byStage = limit === undefined ? Infinity : new Date(order.updated_at).getTime() + limit * HOUR;
  const promised = order.deliver_by ? new Date(order.deliver_by).getTime() : Infinity;
  return Math.min(byStage, promised);
}

export type QueueKey = 'overdue' | 'ready' | 'working' | 'new' | 'stuck';

/** Where an order belongs on the board; null once it is finished or cancelled. */
export function classify(order: QueueOrder, now: Date): QueueKey | null {
  if (isOver(order)) return null;
  if (idleFor(order, now) > STUCK_AFTER_DAYS * DAY) return 'stuck';
  if (order.status === 'ready') return 'ready';
  if (now.getTime() > deadline(order)) return 'overdue';
  return order.status === 'pending' ? 'new' : 'working';
}

export interface QueueSection<T extends QueueOrder> {
  key: QueueKey;
  title: string;
  data: T[];
}

const SECTION_TITLES: Record<QueueKey, string> = {
  overdue: 'Overdue',
  ready: 'Ready for pickup',
  working: 'In the machines',
  new: 'Not started',
  stuck: 'Stuck',
};

const LIVE_ORDER: readonly QueueKey[] = ['overdue', 'ready', 'working', 'new'];

/** At the counter, whoever has waited longest goes first; everything else, the tightest deadline. */
function byUrgency(key: QueueKey) {
  return (a: QueueOrder, b: QueueOrder): number =>
    key === 'ready' || key === 'stuck'
      ? new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      : deadline(a) - deadline(b);
}

/**
 * The live queue by urgency, or — with `stuck` — only the orders nobody is
 * working, oldest first.
 */
export function queueSections<T extends QueueOrder>(
  orders: readonly T[],
  now: Date,
  { stuck = false }: { stuck?: boolean } = {}
): QueueSection<T>[] {
  const keys: readonly QueueKey[] = stuck ? ['stuck'] : LIVE_ORDER;
  const byKey = new Map<QueueKey, T[]>();
  for (const order of orders) {
    const key = classify(order, now);
    if (key && keys.includes(key)) byKey.set(key, [...(byKey.get(key) ?? []), order]);
  }
  return keys
    .filter((key) => byKey.has(key))
    .map((key) => ({
      key,
      title: SECTION_TITLES[key],
      data: [...(byKey.get(key) ?? [])].sort(byUrgency(key)),
    }));
}

/** Unpaid once the laundry is ready to leave; before that, paying at pickup is normal. */
export function showsUnpaid(order: QueueOrder): boolean {
  return order.payment_status !== 'paid' && (order.status === 'ready' || order.status === 'completed');
}

const orderValue = (order: QueueOrder): number => order.final_total ?? order.estimated_total;

export interface QueueStats {
  overdue: number;
  /** Moving or not yet started, and on time. */
  inProgress: number;
  ready: number;
  stuck: number;
  /** Pesos owed on laundry that is ready or already handed over. */
  toCollect: number;
  toCollectCount: number;
}

export function queueStats(orders: readonly QueueOrder[], now: Date): QueueStats {
  const stats: QueueStats = { overdue: 0, inProgress: 0, ready: 0, stuck: 0, toCollect: 0, toCollectCount: 0 };
  for (const order of orders) {
    const key = classify(order, now);
    if (key === 'overdue') stats.overdue += 1;
    if (key === 'working' || key === 'new') stats.inProgress += 1;
    if (key === 'ready') stats.ready += 1;
    if (key === 'stuck') stats.stuck += 1;
    if (showsUnpaid(order)) {
      stats.toCollect += orderValue(order);
      stats.toCollectCount += 1;
    }
  }
  return stats;
}

export type RowAction =
  | { kind: 'advance'; to: OrderStatus; label: string }
  /** Ready but unpaid: the money comes before the bag leaves the counter. */
  | { kind: 'collect'; label: string }
  /** Stuck: the customer is the only one who can unstick it. */
  | { kind: 'call'; label: string; phone: string };

/** A stuck order's button rings the customer; with no number, the row just opens. */
export function stuckAction(order: QueueOrder): RowAction | null {
  const phone = orderContact(order).phone;
  return phone ? { kind: 'call', label: 'Call', phone } : null;
}

/** Short verbs: the button sits beside a name and a price on a narrow row. */
const ADVANCE: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending: { to: 'received', label: 'Receive' },
  received: { to: 'washing', label: 'Wash' },
  washing: { to: 'drying', label: 'Dry' },
  drying: { to: 'folded', label: 'Fold' },
  folded: { to: 'ready', label: 'Ready' },
  ready: { to: 'completed', label: 'Hand over' },
};

export function rowAction(order: QueueOrder): RowAction | null {
  if (order.status === 'ready' && order.payment_status !== 'paid') {
    return { kind: 'collect', label: 'Collect' };
  }
  const step = ADVANCE[order.status];
  return step ? { kind: 'advance', ...step } : null;
}

/** Only the hand-over asks first: every other step is one more along the line. */
export function handOverPrompt(order: QueueOrder): ConfirmPrompt {
  return {
    title: `Hand over to ${queueTitle(order)}?`,
    message: 'The order moves to Done. This cannot be undone.',
    confirmLabel: 'Hand over',
    dismissLabel: 'Not yet',
  };
}

/** A name, else the number to ring, else where it came from and the ticket to find it by. */
export function queueTitle(order: QueueOrder): string {
  const contact = orderContact(order);
  if (contact.isNamed) return contact.name;
  if (contact.phone) return contact.phone;
  const origin = order.order_type === 'online' ? 'Online' : 'Walk-in';
  return `${origin} ${shortOrderId(order.id)}`;
}

/** `45m`, `5h`, `19d` — the way a glance at a wall clock would put it. */
export function compactAge(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / MINUTE))}m`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h`;
  return `${Math.floor(ms / DAY)}d`;
}

export interface StatusLine {
  text: string;
  isOverdue: boolean;
}

/** The stage and the one time that matters for it. Only overdue earns red. */
export function statusLine(order: QueueOrder, now: Date): StatusLine {
  const word = STAGE_WORDS[order.status];
  const key = classify(order, now);
  if (key === null) return { text: `${word} ${formatOrderTime(order.updated_at, now)}`, isOverdue: false };
  if (key === 'stuck') {
    return { text: `${word} · no change for ${compactAge(idleFor(order, now))}`, isOverdue: false };
  }
  if (order.deliver_by && order.status !== 'ready') {
    const due = formatOrderTime(order.deliver_by, now);
    const isPast = now.getTime() > new Date(order.deliver_by).getTime();
    if (isPast) return { text: `${word} · was due ${due}`, isOverdue: true };
    if (key !== 'overdue') return { text: `${word} · due ${due}`, isOverdue: false };
  }
  return { text: `${word} for ${compactAge(idleFor(order, now))}`, isOverdue: key === 'overdue' };
}
