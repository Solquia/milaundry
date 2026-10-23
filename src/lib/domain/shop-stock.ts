/**
 * The shelf and the bottles, as the owner checks them from away: what needs
 * restocking, what sold in the period and how much is left of it, and how
 * much of each free supply the period's loads poured.
 *
 * Stock left comes from `addon-inventory`, the same count the Prices screen
 * keeps, so a pack sold at the counter shows here as soon as the order list
 * refreshes. Supply use comes from the database (0055), which already knows
 * which loads brought their own soap.
 */
import {
  restockOrder,
  stockLines,
  type AddonCost,
  type AddonSales,
  type StockLine,
  type StockStatus,
} from './addon-inventory';
import { roundCentavos } from './money';
import type { OrderStatus } from './order-status';
import type { PeriodFrame } from './sales-period';
import type { SupplyUnit, SupplyUse } from './service-costs';
import type { ShopAddon } from './shop-addons';

export interface StockOrder {
  status: OrderStatus;
  created_at: string;
  order_items: readonly { addon_id?: string | null; quantity: number; service_name: string }[];
}

export interface SoldAddon {
  id: string;
  name: string;
  quantity: number;
  /** Packs left on the shelf, or null when it is not counted. */
  left: number | null;
  status: StockStatus;
}

export interface SupplyRow {
  id: string;
  name: string;
  unit: SupplyUnit;
  amount: number;
  /** How many bottles (or bags, or boxes) that is, to one decimal. */
  packs: number;
  cost: number;
}

export interface ShopStock {
  /** Counted add-ons that are out or low, out first. */
  restock: StockLine[];
  /** Add-ons on sale that were never counted. */
  uncounted: number;
  /** Add-ons sold in the period, most first. */
  addonsSold: SoldAddon[];
  supplies: SupplyRow[];
  suppliesCost: number;
  /** Add-ons on sale with no cost price, so their profit is unknown. */
  addonsWithoutCost: number;
}

type StockFrame = Pick<PeriodFrame, 'start' | 'cutoff'>;

export function shopStock(input: {
  orders: readonly StockOrder[];
  addons: readonly ShopAddon[];
  sales: readonly AddonSales[];
  costs: readonly AddonCost[];
  supplyUse: readonly SupplyUse[];
  frame: StockFrame;
}): ShopStock {
  const onSale = input.addons.filter((addon) => addon.is_active);
  const lines = stockLines(onSale, input.sales, input.costs);
  const lineById = new Map(lines.map((line) => [line.addon.id, line]));

  return {
    restock: restockOrder(lines).filter((line) => line.status === 'out' || line.status === 'low'),
    uncounted: lines.filter((line) => line.status === 'untracked').length,
    addonsSold: soldIn(input.orders, input.frame, lineById),
    supplies: input.supplyUse.map((row) => ({
      id: row.supplyId,
      name: row.name,
      unit: row.unit,
      amount: row.amount,
      packs: row.packSize > 0 ? Math.round((row.amount / row.packSize) * 10) / 10 : 0,
      cost: row.cost,
    })),
    suppliesCost: roundCentavos(input.supplyUse.reduce((sum, row) => sum + row.cost, 0)),
    addonsWithoutCost: lines.filter((line) => line.unitCost === null).length,
  };
}

function soldIn(
  orders: readonly StockOrder[],
  frame: StockFrame,
  lineById: ReadonlyMap<string, StockLine>
): SoldAddon[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const time = new Date(order.created_at).getTime();
    if (time < frame.start || time >= frame.cutoff) continue;
    for (const item of order.order_items) {
      if (!item.addon_id) continue;
      counts.set(item.addon_id, (counts.get(item.addon_id) ?? 0) + Number(item.quantity));
    }
  }
  return [...counts.entries()]
    .map(([id, quantity]) => {
      const line = lineById.get(id);
      return {
        id,
        name: line?.addon.name ?? 'Add-on',
        quantity,
        left: line?.left ?? null,
        status: line?.status ?? 'untracked',
      };
    })
    .sort((a, b) => b.quantity - a.quantity);
}
