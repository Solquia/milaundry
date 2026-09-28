/**
 * What the shop sold in a period, four ways, each measured against the same
 * point in the period before.
 *
 * Two clocks, named out loud so the screen can say which one a figure uses:
 * **Sales** is money *paid* in the period (an order taken last week and paid
 * this morning is this morning's sale). **Orders**, **kilos** and **basket**
 * are orders *taken* in the period. The old screen mixed the two without
 * saying so; here each metric carries its own clock.
 */
import type { PaymentMethod } from './walk-in-order';
import type { OrderStatus } from './order-status';
import type { OrderType, PaymentStatus } from './order-tags';
import type { PricingUnit } from './pricing';
import { orderContact } from './order-contact';
import { PAYMENT_LABELS } from './payment-summary';
import type { PeriodBucket, PeriodFrame } from './sales-period';
import { roundCentavos } from './money';

export interface SalesItem {
  service_name: string;
  unit: PricingUnit;
  quantity: number;
  subtotal: number;
}

export interface SalesOrder {
  id: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  order_type: OrderType;
  estimated_total: number;
  final_total: number | null;
  paid_at: string | null;
  created_at: string;
  actual_weight_kg: number | null;
  customer_name: string;
  customer_phone: string;
  customer_id: string | null;
  order_items: readonly SalesItem[];
}

export const METRIC_KEYS = ['sales', 'orders', 'kilos', 'basket'] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export interface MetricSummary {
  key: MetricKey;
  total: number;
  /** The comparison period up to the same point. */
  compareTotal: number;
  delta: number;
  /** Whole percent; null when there is nothing to compare against. */
  deltaPct: number | null;
  /** One value per bucket of the frame. */
  series: number[];
  /** The comparison period's value for each bucket, in full: the ghost. */
  compareSeries: number[];
}

export interface SalesPayment {
  id: string;
  amount: number;
  method: PaymentMethod;
  name: string;
  paidAt: string;
}

export interface MethodShare {
  key: PaymentMethod;
  label: string;
  amount: number;
  /** Whole percent of sales. */
  share: number;
}

export interface Bestseller {
  name: string;
  unit: PricingUnit;
  quantity: number;
  revenue: number;
  compareRevenue: number;
  deltaPct: number | null;
}

export interface SalesSummary {
  metrics: Record<MetricKey, MetricSummary>;
  payments: SalesPayment[];
  methods: MethodShare[];
  bestsellers: Bestseller[];
}

const BESTSELLERS = 8;

const valueOf = (order: SalesOrder): number => order.final_total ?? order.estimated_total;
const timeOf = (iso: string | null): number => (iso ? new Date(iso).getTime() : NaN);
const within = (time: number, from: number, to: number): boolean => time >= from && time < to;
const round1 = (value: number): number => Math.round(value * 10) / 10;

/** The scale's reading when the load was weighed, else the kilos on the ticket. */
export function kilosOf(order: SalesOrder): number {
  if (order.actual_weight_kg !== null && order.actual_weight_kg !== undefined) {
    return Number(order.actual_weight_kg);
  }
  return order.order_items
    .filter((item) => item.unit === 'per_kg')
    .reduce((sum, item) => sum + Number(item.quantity), 0);
}

export function percentChange(total: number, compare: number): number | null {
  return compare === 0 ? null : Math.round(((total - compare) / compare) * 100);
}

type Clock = 'paid' | 'taken';

const METRIC_CLOCK: Record<MetricKey, Clock> = { sales: 'paid', orders: 'taken', kilos: 'taken', basket: 'taken' };

/** Adds an order to a running tally for one metric. */
interface Tally {
  sum: number;
  count: number;
}

const blank = (): Tally => ({ sum: 0, count: 0 });

function contribution(key: MetricKey, order: SalesOrder): number {
  switch (key) {
    case 'sales':
    case 'basket':
      return valueOf(order);
    case 'orders':
      return 1;
    case 'kilos':
      return kilosOf(order);
  }
}

function settle(key: MetricKey, tally: Tally): number {
  if (key === 'basket') return tally.count === 0 ? 0 : roundCentavos(tally.sum / tally.count);
  if (key === 'kilos') return round1(tally.sum);
  if (key === 'orders') return tally.sum;
  return roundCentavos(tally.sum);
}

function stampOf(order: SalesOrder, clock: Clock): number {
  if (clock === 'taken') return timeOf(order.created_at);
  return order.payment_status === 'paid' ? timeOf(order.paid_at) : NaN;
}

function indexIn(buckets: readonly PeriodBucket[], time: number, side: 'own' | 'twin'): number {
  return buckets.findIndex((bucket) =>
    side === 'own'
      ? within(time, bucket.start, bucket.end)
      : within(time, bucket.compareStart, bucket.compareEnd)
  );
}

function measure(key: MetricKey, orders: readonly SalesOrder[], frame: PeriodFrame): MetricSummary {
  const clock = METRIC_CLOCK[key];
  const own = blank();
  const twin = blank();
  const series = frame.buckets.map(blank);
  const compareSeries = frame.buckets.map(blank);

  for (const order of orders) {
    const time = stampOf(order, clock);
    if (Number.isNaN(time)) continue;
    const amount = contribution(key, order);
    if (within(time, frame.start, frame.cutoff)) {
      own.sum += amount;
      own.count += 1;
    }
    if (within(time, frame.compareStart, frame.compareCutoff)) {
      twin.sum += amount;
      twin.count += 1;
    }
    const at = indexIn(frame.buckets, time, 'own');
    if (at >= 0 && time < frame.cutoff) {
      series[at].sum += amount;
      series[at].count += 1;
    }
    const ghost = indexIn(frame.buckets, time, 'twin');
    if (ghost >= 0) {
      compareSeries[ghost].sum += amount;
      compareSeries[ghost].count += 1;
    }
  }

  const total = settle(key, own);
  const compareTotal = settle(key, twin);
  return {
    key,
    total,
    compareTotal,
    delta: key === 'kilos' ? round1(total - compareTotal) : roundCentavos(total - compareTotal),
    deltaPct: percentChange(total, compareTotal),
    series: series.map((tally) => settle(key, tally)),
    compareSeries: compareSeries.map((tally) => settle(key, tally)),
  };
}

function paymentsIn(orders: readonly SalesOrder[], frame: PeriodFrame): SalesPayment[] {
  return orders
    .filter((order) => within(stampOf(order, 'paid'), frame.start, frame.cutoff))
    .map((order) => ({
      id: order.id,
      amount: roundCentavos(valueOf(order)),
      method: order.payment_method,
      name: orderContact(order).name,
      paidAt: order.paid_at ?? '',
    }))
    .sort((a, b) => timeOf(b.paidAt) - timeOf(a.paidAt));
}

function methodsOf(payments: readonly SalesPayment[]): MethodShare[] {
  const totals = new Map<PaymentMethod, number>();
  for (const payment of payments) totals.set(payment.method, (totals.get(payment.method) ?? 0) + payment.amount);
  const grand = payments.reduce((sum, payment) => sum + payment.amount, 0);
  return [...totals.entries()]
    .map(([key, amount]) => ({
      key,
      label: PAYMENT_LABELS[key],
      amount: roundCentavos(amount),
      share: grand <= 0 ? 0 : Math.round((amount / grand) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function serviceTotals(orders: readonly SalesOrder[], from: number, to: number) {
  const totals = new Map<string, { unit: PricingUnit; quantity: number; revenue: number }>();
  for (const order of orders) {
    if (!within(timeOf(order.created_at), from, to)) continue;
    for (const item of order.order_items) {
      const entry = totals.get(item.service_name) ?? { unit: item.unit, quantity: 0, revenue: 0 };
      totals.set(item.service_name, {
        unit: entry.unit,
        quantity: entry.quantity + Number(item.quantity),
        revenue: entry.revenue + Number(item.subtotal),
      });
    }
  }
  return totals;
}

function bestsellersOf(orders: readonly SalesOrder[], frame: PeriodFrame): Bestseller[] {
  const now = serviceTotals(orders, frame.start, frame.cutoff);
  const before = serviceTotals(orders, frame.compareStart, frame.compareCutoff);
  return [...now.entries()]
    .map(([name, entry]) => {
      const compareRevenue = roundCentavos(before.get(name)?.revenue ?? 0);
      const revenue = roundCentavos(entry.revenue);
      return {
        name,
        unit: entry.unit,
        quantity: round1(entry.quantity),
        revenue,
        compareRevenue,
        deltaPct: percentChange(revenue, compareRevenue),
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, BESTSELLERS);
}

export function computeSales(orders: readonly SalesOrder[], frame: PeriodFrame): SalesSummary {
  const live = orders.filter((order) => order.status !== 'cancelled');
  const payments = paymentsIn(live, frame);
  const metrics = Object.fromEntries(
    METRIC_KEYS.map((key) => [key, measure(key, live, frame)])
  ) as Record<MetricKey, MetricSummary>;
  return {
    metrics,
    payments,
    methods: methodsOf(payments),
    bestsellers: bestsellersOf(live, frame),
  };
}