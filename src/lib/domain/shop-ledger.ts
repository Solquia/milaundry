/**
 * The owner's ledger for a period: every order taken, what it sold for,
 * whether it is paid, what it used in supplies and products, what it left,
 * and who at the counter took it.
 *
 * It is the view an owner who is not in the shop needs to trust the shop: the
 * same figures the counter sees, plus the ones staff never do. Money in and
 * money still out come from `day-cash`, so this screen and the Customers
 * strip can never disagree.
 */
import { dayCash, type DayCashOrder } from './day-cash';
import { roundCentavos } from './money';
import { orderContact } from './order-contact';
import type { OrderType } from './order-tags';
import type { PeriodFrame } from './sales-period';
import type { PeriodOrderCost } from './service-costs';

export interface LedgerOrder extends DayCashOrder {
  order_type: OrderType;
  customer_name: string;
  customer_phone: string;
  customer_id: string | null;
}

export interface LedgerRow {
  id: string;
  createdAt: string;
  name: string;
  takenBy: string | null;
  total: number;
  isPaid: boolean;
  /** Supplies and products used; null until set up or while loading. */
  supplies: number | null;
  profit: number | null;
}

export interface LedgerTotals {
  /** Orders taken in the period, cancelled ones left out. */
  taken: number;
  /** What those orders sold for, paid or not. */
  sold: number;
  /** Paid in the period, whenever the order was taken. */
  cashIn: number;
  /** The period's orders still unpaid. */
  toCollect: number;
  /** Supplies and products the period's orders used, where a cost is set. */
  supplies: number;
  /** Sold less supplies, over the orders with a cost. */
  profit: number;
  /** Orders with at least one line that has no cost set. */
  uncosted: number;
}

export interface ShopLedger {
  rows: LedgerRow[];
  totals: LedgerTotals;
}

type LedgerFrame = Pick<PeriodFrame, 'start' | 'cutoff'>;

const valueOf = (order: LedgerOrder): number => order.final_total ?? order.estimated_total;
const timeOf = (iso: string): number => new Date(iso).getTime();

export function shopLedger(
  orders: readonly LedgerOrder[],
  costs: readonly PeriodOrderCost[] | undefined,
  frame: LedgerFrame
): ShopLedger {
  const byId = new Map((costs ?? []).map((row) => [row.orderId, row]));
  const taken = orders
    .filter((order) => order.status !== 'cancelled')
    .filter((order) => {
      const time = timeOf(order.created_at);
      return time >= frame.start && time < frame.cutoff;
    })
    .sort((a, b) => timeOf(b.created_at) - timeOf(a.created_at));

  const rows = taken.map((order): LedgerRow => {
    const total = roundCentavos(valueOf(order));
    const cost = byId.get(order.id);
    const supplies = cost?.cost ?? null;
    return {
      id: order.id,
      createdAt: order.created_at,
      name: orderContact(order).name,
      takenBy: cost?.takenBy ?? null,
      total,
      isPaid: order.payment_status === 'paid',
      supplies,
      profit: supplies === null ? null : roundCentavos(total - supplies),
    };
  });

  const costed = rows.filter((row) => row.supplies !== null);
  const cash = dayCash(orders, frame);
  const uncosted = taken.filter((order) => {
    const cost = byId.get(order.id);
    return cost !== undefined && (cost.cost === null || cost.costedLines < cost.lines);
  }).length;

  return {
    rows,
    totals: {
      taken: rows.length,
      sold: roundCentavos(rows.reduce((sum, row) => sum + row.total, 0)),
      cashIn: cash.cashIn,
      toCollect: cash.toCollect,
      supplies: roundCentavos(costed.reduce((sum, row) => sum + (row.supplies ?? 0), 0)),
      profit: roundCentavos(costed.reduce((sum, row) => sum + (row.profit ?? 0), 0)),
      uncosted,
    },
  };
}
