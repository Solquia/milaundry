/**
 * Stock for the add-on shelf: what is in the shop, what is left, what sold.
 *
 * The owner counts the shelf (or adds a delivery to it) and the server keeps
 * that count and when it was taken (0049). What is left is never stored: it is
 * the count less what orders have taken since, so a cancelled order or a line
 * changed at the counter puts it right by itself. This file turns the shelf
 * and its sales into what the Stock screen says.
 */
import type { ShopAddon } from './shop-addons';

/** Sales of one add-on, as `get_addon_sales` reports them. */
export interface AddonSales {
  addon_id: string;
  sold_since_count: number;
  sold_recent: number;
  sold_total: number;
  revenue_recent: number;
}

/** "Best sellers" and the sales figures look back this far. */
export const RECENT_DAYS = 30;
/** This many left or fewer and the shelf needs topping up. */
export const LOW_STOCK_AT = 5;
/** The most one count may say. The database agrees. */
export const STOCK_LIMIT = 100_000;
const BEST_SELLER_COUNT = 3;

export type StockStatus = 'untracked' | 'out' | 'low' | 'ok';

export interface StockLine {
  addon: ShopAddon;
  /** The last count, or null when the owner has never counted it. */
  counted: number | null;
  /** The count less what has sold since. Null when not counted. */
  left: number | null;
  soldSinceCount: number;
  soldRecent: number;
  soldTotal: number;
  revenueRecent: number;
  status: StockStatus;
}

export function stockStatus(left: number | null): StockStatus {
  if (left === null) return 'untracked';
  if (left <= 0) return 'out';
  if (left <= LOW_STOCK_AT) return 'low';
  return 'ok';
}

const NO_SALES = { sold_since_count: 0, sold_recent: 0, sold_total: 0, revenue_recent: 0 };

/** One line per add-on, in the shelf's own order, with its sales and what is left. */
export function stockLines(addons: readonly ShopAddon[], sales: readonly AddonSales[]): StockLine[] {
  const byId = new Map(sales.map((row) => [row.addon_id, row]));
  return addons.map((addon) => {
    const sold = byId.get(addon.id) ?? NO_SALES;
    const counted = addon.stock_count ?? null;
    // More sold than counted means the count was short; nothing is left either way.
    const left = counted === null ? null : Math.max(0, counted - sold.sold_since_count);
    return {
      addon,
      counted,
      left,
      soldSinceCount: sold.sold_since_count,
      soldRecent: sold.sold_recent,
      soldTotal: sold.sold_total,
      revenueRecent: sold.revenue_recent,
      status: stockStatus(left),
    };
  });
}

/** The add-ons that sold most lately, most first. Ties go to the one that took more money. */
export function bestSellers(lines: readonly StockLine[], limit = BEST_SELLER_COUNT): StockLine[] {
  return lines
    .filter((line) => line.soldRecent > 0)
    .sort(
      (a, b) =>
        b.soldRecent - a.soldRecent ||
        b.revenueRecent - a.revenueRecent ||
        a.addon.name.localeCompare(b.addon.name)
    )
    .slice(0, limit);
}

export interface StockSummary {
  /** Packs left across every counted add-on. */
  left: number;
  soldRecent: number;
  revenueRecent: number;
  /** Counted add-ons that are low or out. */
  needRestock: number;
  /** Add-ons the owner has not counted yet. */
  uncounted: number;
}

export function stockSummary(lines: readonly StockLine[]): StockSummary {
  const cents = lines.reduce((sum, line) => sum + Math.round(line.revenueRecent * 100), 0);
  return {
    left: lines.reduce((sum, line) => sum + (line.left ?? 0), 0),
    soldRecent: lines.reduce((sum, line) => sum + line.soldRecent, 0),
    revenueRecent: cents / 100,
    needRestock: lines.filter((line) => line.status === 'out' || line.status === 'low').length,
    uncounted: lines.filter((line) => line.status === 'untracked').length,
  };
}

/** What needs topping up first, then the rest; uncounted ones last. Stable within each. */
export function restockOrder(lines: readonly StockLine[]): StockLine[] {
  const rank: Record<StockStatus, number> = { out: 0, low: 1, ok: 2, untracked: 3 };
  return [...lines].sort((a, b) => rank[a.status] - rank[b.status]);
}

export type StockInput = { ok: true; value: number } | { ok: false; error: string };

/** A typed number of packs: a whole number from 0 to the limit. */
export function parseStockInput(text: string): StockInput {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, error: 'Type how many packs.' };
  const value = Number(trimmed);
  if (!Number.isInteger(value) || value < 0) {
    return { ok: false, error: 'Use a whole number, like 12.' };
  }
  if (value > STOCK_LIMIT) return { ok: false, error: 'That is more than one shelf can hold.' };
  return { ok: true, value };
}

/** The new count after a delivery of `received` lands on what is left. */
export function restockedCount(line: Pick<StockLine, 'left'>, received: number): number {
  return Math.min(STOCK_LIMIT, (line.left ?? 0) + received);
}

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  untracked: 'Not counted',
  out: 'Out of stock',
  low: 'Running low',
  ok: 'In stock',
};
