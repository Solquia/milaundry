/**
 * What the shop earned over a chosen window, and where it came from.
 *
 * Money is counted by the day it was *paid*, orders by the day they were
 * *taken*, the same split `daily-analytics` makes for a single day — an order
 * booked last week and paid this morning is this morning's money. Receivables
 * ignore the window entirely: what is owed is owed, however old.
 */
import {
  isWithin,
  previousWindow,
  rangeWindow,
  trendBuckets,
  type DateWindow,
  type RangeKey,
} from './analytics-range';
import type { AnalyticsOrder } from './daily-analytics';
import { roundCentavos } from './money';
import type { OrderType } from './order-tags';
import { PAYMENT_LABELS } from './payment-summary';
import { PAYMENT_METHODS, type PaymentMethod } from './walk-in-order';

export interface EarningsItem {
  service_name: string;
  subtotal: number;
}

export interface EarningsOrder extends AnalyticsOrder {
  order_type: OrderType;
  payment_method: PaymentMethod;
  order_items: readonly EarningsItem[];
}

/** One slice of a whole: money, and its share of the total in whole percent. */
export interface ShareRow<K extends string = string> {
  key: K;
  label: string;
  amount: number;
  share: number;
}

export interface TrendPoint {
  label: string;
  amount: number;
  isCurrent: boolean;
}

export interface ServiceRank {
  name: string;
  revenue: number;
  /** Order lines that carried this service. */
  count: number;
  share: number;
}

export interface EarningsSummary {
  /** Paid inside the window. */
  collected: number;
  paymentsCount: number;
  /** Taken inside the window, cancelled ones excluded. */
  ordersTaken: number;
  averageOrder: number;
  /** Owed to the shop right now, any date. */
  receivables: number;
  unpaidCount: number;
  /** Collected in the previous window of the same length; null for all time. */
  previousCollected: number | null;
  /** Whole-percent change; null when there is nothing to compare against. */
  changePct: number | null;
  trend: TrendPoint[];
  trendPeak: number;
  sources: ShareRow<OrderType>[];
  methods: ShareRow<PaymentMethod>[];
  topServices: ServiceRank[];
}

const TOP_SERVICES = 5;

const SOURCE_LABELS: Record<OrderType, string> = { walk_in: 'Walk-in', online: 'Online' };

const orderValue = (order: AnalyticsOrder): number => order.final_total ?? order.estimated_total;

const sumValue = (orders: readonly EarningsOrder[]): number =>
  roundCentavos(orders.reduce((sum, order) => sum + orderValue(order), 0));

const share = (amount: number, total: number): number =>
  total <= 0 ? 0 : Math.round((amount / total) * 100);

const isPaidIn = (order: EarningsOrder, window: DateWindow): boolean =>
  order.payment_status === 'paid' && isWithin(order.paid_at, window);

export function computeEarnings(
  orders: readonly EarningsOrder[],
  range: RangeKey,
  now: Date
): EarningsSummary {
  const window = rangeWindow(range, now);
  const previous = previousWindow(window);
  const live = orders.filter((order) => order.status !== 'cancelled');

  const paidHere = live.filter((order) => isPaidIn(order, window));
  const takenHere = live.filter((order) => isWithin(order.created_at, window));
  const unpaid = live.filter((order) => order.payment_status !== 'paid');

  const collected = sumValue(paidHere);
  const previousCollected =
    previous === null ? null : sumValue(live.filter((order) => isPaidIn(order, previous)));

  const trend = trendBuckets(range, now).map((bucket) => ({
    label: bucket.label,
    isCurrent: bucket.isCurrent,
    amount: sumValue(live.filter((order) => isPaidIn(order, bucket))),
  }));

  return {
    collected,
    paymentsCount: paidHere.length,
    ordersTaken: takenHere.length,
    averageOrder:
      takenHere.length === 0 ? 0 : roundCentavos(sumValue(takenHere) / takenHere.length),
    receivables: sumValue(unpaid),
    unpaidCount: unpaid.length,
    previousCollected,
    changePct:
      previousCollected === null || previousCollected === 0
        ? null
        : Math.round(((collected - previousCollected) / previousCollected) * 100),
    trend,
    trendPeak: trend.reduce((peak, point) => Math.max(peak, point.amount), 0),
    sources: splitBySource(paidHere, collected),
    methods: splitByMethod(paidHere, collected),
    topServices: rankServices(takenHere),
  };
}

function splitBySource(paid: readonly EarningsOrder[], total: number): ShareRow<OrderType>[] {
  return (['walk_in', 'online'] as const).map((key) => {
    const amount = sumValue(paid.filter((order) => order.order_type === key));
    return { key, label: SOURCE_LABELS[key], amount, share: share(amount, total) };
  });
}

function splitByMethod(
  paid: readonly EarningsOrder[],
  total: number
): ShareRow<PaymentMethod>[] {
  return PAYMENT_METHODS.map((key) => {
    const amount = sumValue(paid.filter((order) => order.payment_method === key));
    return { key, label: PAYMENT_LABELS[key], amount, share: share(amount, total) };
  })
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

function rankServices(taken: readonly EarningsOrder[]): ServiceRank[] {
  const totals = new Map<string, { revenue: number; count: number }>();
  for (const order of taken) {
    for (const item of order.order_items) {
      const entry = totals.get(item.service_name) ?? { revenue: 0, count: 0 };
      totals.set(item.service_name, {
        revenue: entry.revenue + item.subtotal,
        count: entry.count + 1,
      });
    }
  }
  const all = [...totals.entries()].map(([name, entry]) => ({
    name,
    revenue: roundCentavos(entry.revenue),
    count: entry.count,
  }));
  const grand = all.reduce((sum, row) => sum + row.revenue, 0);
  return all
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, TOP_SERVICES)
    .map((row) => ({ ...row, share: share(row.revenue, grand) }));
}

const PREVIOUS_NAMES: Record<RangeKey, string> = {
  today: 'yesterday',
  '7d': 'previous 7 days',
  '30d': 'previous 30 days',
  '90d': 'previous 90 days',
  all: '',
};

export type ChangeTone = 'up' | 'down' | 'flat';

/** `+50% vs yesterday`. Null when the comparison would be against nothing. */
export function describeChange(
  changePct: number | null,
  range: RangeKey
): { text: string; tone: ChangeTone } | null {
  if (changePct === null || range === 'all') return null;
  const against = PREVIOUS_NAMES[range];
  if (changePct > 0) return { text: `+${changePct}% vs ${against}`, tone: 'up' };
  if (changePct < 0) return { text: `−${Math.abs(changePct)}% vs ${against}`, tone: 'down' };
  return { text: `Same as ${against}`, tone: 'flat' };
}
