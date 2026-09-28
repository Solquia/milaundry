/**
 * How the Sales screen words its figures: each metric in its own unit, the
 * pace as "ahead" or "behind" rather than a bare percentage, and a service
 * counted the way the counter counts it.
 */
import { formatMoneyCompact } from './money';
import type { PricingUnit } from './pricing';
import type { MetricKey } from './sales-metrics';
import type { BucketUnit } from './sales-period';

export interface MetricLook {
  label: string;
  /** Which clock the metric counts by, said out loud. */
  clock: string;
  icon: string;
}

export const METRIC_LOOKS: Record<MetricKey, MetricLook> = {
  sales: { label: 'Sales', clock: 'Paid in this period', icon: 'cash-outline' },
  orders: { label: 'Orders', clock: 'Taken in this period', icon: 'receipt-outline' },
  kilos: { label: 'Kilos', clock: 'Taken in this period', icon: 'barbell-outline' },
  basket: { label: 'Avg basket', clock: 'Per order taken', icon: 'basket-outline' },
};

const isMoney = (key: MetricKey): boolean => key === 'sales' || key === 'basket';
const trimZero = (value: number): string => String(Math.round(value * 10) / 10);

export function formatMetric(key: MetricKey, value: number): string {
  if (isMoney(key)) return formatMoneyCompact(value);
  if (key === 'kilos') return `${trimZero(value)} kg`;
  return String(Math.round(value));
}

export type PaceTone = 'up' | 'down' | 'flat';

export function paceLine(key: MetricKey, delta: number, against: string): { text: string; tone: PaceTone } {
  if (Math.abs(delta) < 0.005) return { text: `Level with ${against}`, tone: 'flat' };
  const size = formatMetric(key, Math.abs(delta));
  return delta > 0
    ? { text: `${size} ahead of ${against}`, tone: 'up' }
    : { text: `${size} behind ${against}`, tone: 'down' };
}

export function quantityLabel(quantity: number, unit: PricingUnit): string {
  const amount = trimZero(quantity);
  if (unit === 'per_kg') return `${amount} kg`;
  if (unit === 'per_item') return `${amount} ${quantity === 1 ? 'pc' : 'pcs'}`;
  return `${amount} ${quantity === 1 ? 'load' : 'loads'}`;
}

const OPENS = 7;
const CLOSES = 22;

/** The slice of buckets worth drawing: a day trims to shop hours unless a sale fell outside them. */
export function visibleRange(
  unit: BucketUnit,
  series: readonly number[],
  compare: readonly number[]
): { from: number; to: number } {
  if (unit !== 'hour') return { from: 0, to: series.length };
  const busy = series.map((value, index) => (value > 0 || (compare[index] ?? 0) > 0 ? index : -1)).filter((i) => i >= 0);
  return {
    from: Math.min(OPENS, ...busy),
    to: Math.max(CLOSES, ...busy.map((index) => index + 1)),
  };
}
