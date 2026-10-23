/**
 * What a service costs the shop to do, costed like a dish by its ingredients.
 *
 * The owner lists the free supplies a load goes out with (detergent, fabcon,
 * bleach, colorsafe, odor remover), each by the bottle it comes in, and says
 * how much of each one service uses (0051). This file turns that into a cost
 * and a profit per load, per service over the month, and per order.
 *
 * Nothing here is shown to staff: the screens that use it are the owner's.
 */
import type { ServiceRow } from '../types';
import { isWeighed } from './pricing';

export type SupplyUnit = 'ml' | 'g' | 'pc';

export const SUPPLY_UNITS: readonly SupplyUnit[] = ['ml', 'g', 'pc'];

export const SUPPLY_UNIT_LABEL: Record<SupplyUnit, string> = { ml: 'ml', g: 'g', pc: 'pcs' };

/** One free supply the shop buys, by the bottle (or bag, or box) it comes in. */
export interface Supply {
  id: string;
  shop_id: string;
  name: string;
  unit: SupplyUnit;
  pack_size: number;
  pack_cost: number;
  /**
   * The add-on that hands this supply out (0053), or null when every load
   * gets it. Linked, it is used only on orders where the customer picked that
   * add-on, which also takes one off the add-on's stock.
   */
  addon_id: string | null;
}

/** How much of one supply one unit of a service uses. */
export interface ServiceSupply {
  service_id: string;
  supply_id: string;
  amount: number;
}

/** One service's costs as `get_service_costs` reports them. */
export interface ServiceCostRow {
  service_id: string;
  unit_cost: number | null;
  units_recent: number;
  revenue_recent: number;
  cost_recent: number | null;
}

/** One order line's cost as `get_order_costs` reports it. */
export interface OrderLineCost {
  item_id: string;
  cost: number | null;
}


/** One order's costs as `get_period_order_costs` reports them (0054). */
export interface PeriodOrderCost {
  orderId: string;
  /** Supplies and products over its costed lines; null when none are costed. */
  cost: number | null;
  lines: number;
  costedLines: number;
  /** Who at the counter took a walk-in; null for an online order. */
  takenBy: string | null;
}


/** What the window's orders used of one free supply, as `get_period_supply_use` reports it (0055). */
export interface SupplyUse {
  supplyId: string;
  name: string;
  unit: SupplyUnit;
  packSize: number;
  amount: number;
  cost: number;
}

/** The most one entry may say. The database agrees. */
export const SUPPLY_LIMIT = 1_000_000;
export const AMOUNT_LIMIT = 100_000;

const cents = (value: number) => Math.round(value * 100);

/** What one ml (or g, or piece) of a supply costs. */
export function costPerUnit(supply: Pick<Supply, 'pack_size' | 'pack_cost'>): number {
  return supply.pack_size > 0 ? supply.pack_cost / supply.pack_size : 0;
}

export type UsageBasis = 'load' | 'kg' | 'piece' | 'order';

export const USAGE_BASIS_LABEL: Record<UsageBasis, string> = {
  load: 'load',
  kg: 'kg',
  piece: 'piece',
  order: 'order',
};

/**
 * What one "unit" of a service is for its supplies: a load when it is washed
 * in loads (a load size is set), else the unit it is priced in. The database's
 * `supply_units` counts a line the same way.
 */
export function usageBasis(
  service: Pick<ServiceRow, 'unit' | 'max_quantity' | 'category'>
): UsageBasis {
  if (service.unit !== 'per_item' && isWeighed(service) && (service.max_quantity ?? 0) > 0) return 'load';
  if (service.unit === 'per_kg') return 'kg';
  if (service.unit === 'per_item') return 'piece';
  return 'order';
}

/** What one unit of a service costs in supplies, or null with no supplies set. */
export function recipeCost(
  serviceId: string,
  recipe: readonly ServiceSupply[],
  supplies: readonly Supply[]
): number | null {
  const byId = new Map(supplies.map((supply) => [supply.id, supply]));
  const lines = recipe.filter((line) => line.service_id === serviceId && byId.has(line.supply_id));
  if (lines.length === 0) return null;
  const total = lines.reduce((sum, line) => sum + line.amount * costPerUnit(byId.get(line.supply_id)!), 0);
  return cents(total) / 100;
}

export interface ServiceProfitLine {
  service: ServiceRow;
  basis: UsageBasis;
  /** Supplies for one unit, or null when none are set. */
  unitCost: number | null;
  /** Price less supplies for one unit, or null when unknown. */
  profitPerUnit: number | null;
  unitsRecent: number;
  revenueRecent: number;
  profitRecent: number | null;
}

/**
 * What one unit sells for. A per-load service's price is per load already; a
 * service priced by weight bands, or by the kg but washed in loads, has no
 * price per load, so none. Its sales still give it a profit for the month.
 */
function unitPrice(service: ServiceRow, basis: UsageBasis): number | null {
  if ((service.weight_prices ?? []).length > 0) return null;
  if (service.unit === 'per_kg' && basis === 'load') return null;
  return service.price;
}

/** One line per service, in the list's own order, with its costs and profit. */
export function serviceProfitLines(
  services: readonly ServiceRow[],
  costs: readonly ServiceCostRow[]
): ServiceProfitLine[] {
  const byId = new Map(costs.map((row) => [row.service_id, row]));
  return services.map((service) => {
    const row = byId.get(service.id);
    const unitCost = row?.unit_cost ?? null;
    const basis = usageBasis(service);
    const price = unitPrice(service, basis);
    const revenueRecent = row?.revenue_recent ?? 0;
    const costRecent = row?.cost_recent ?? null;
    return {
      service,
      basis,
      unitCost,
      profitPerUnit: unitCost === null || price === null ? null : (cents(price) - cents(unitCost)) / 100,
      unitsRecent: row?.units_recent ?? 0,
      revenueRecent,
      profitRecent: costRecent === null ? null : (cents(revenueRecent) - cents(costRecent)) / 100,
    };
  });
}

export interface ProfitSummary {
  revenue: number;
  cost: number;
  profit: number;
  /** How many of the lines counted had no cost set, and were left out. */
  uncosted: number;
}

/** Sales, supply cost and profit across the services that have supplies set. */
export function serviceProfitSummary(lines: readonly ServiceProfitLine[]): ProfitSummary {
  const sold = lines.filter((line) => line.revenueRecent > 0);
  const costed = sold.filter((line) => line.profitRecent !== null);
  const revenue = costed.reduce((sum, line) => sum + cents(line.revenueRecent), 0);
  const profit = costed.reduce((sum, line) => sum + cents(line.profitRecent ?? 0), 0);
  return {
    revenue: revenue / 100,
    cost: (revenue - profit) / 100,
    profit: profit / 100,
    uncosted: sold.length - costed.length,
  };
}

/** One order's cost and profit, over the lines with a cost. */
export function orderProfit(
  items: readonly { id: string; subtotal: number }[],
  costs: readonly OrderLineCost[]
): ProfitSummary {
  const byId = new Map(costs.map((row) => [row.item_id, row.cost]));
  const costed = items.filter((item) => (byId.get(item.id) ?? null) !== null);
  const revenue = costed.reduce((sum, item) => sum + cents(item.subtotal), 0);
  const cost = costed.reduce((sum, item) => sum + cents(byId.get(item.id) ?? 0), 0);
  return {
    revenue: revenue / 100,
    cost: cost / 100,
    profit: (revenue - cost) / 100,
    uncosted: items.length - costed.length,
  };
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function parseNumber(text: string, limit: number, what: string): Parsed<number> {
  const trimmed = text.trim().replace(/^₱/, '').replace(/,/g, '').trim();
  if (trimmed === '') return { ok: false, error: `Type the ${what}.` };
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return { ok: false, error: `Type the ${what} as a number, like 12.5.` };
  if (value > limit) return { ok: false, error: `That ${what} is too big.` };
  return { ok: true, value: cents(value) / 100 };
}

export interface SupplyDraft {
  name: string;
  unit: SupplyUnit;
  pack_size: number;
  pack_cost: number;
  addon_id: string | null;
}

/** A supply as typed: a name, the bottle's size, and what the bottle cost. */
export function parseSupplyDraft(input: {
  name: string;
  unit: SupplyUnit;
  packSize: string;
  packCost: string;
  addonId: string | null;
}): Parsed<SupplyDraft> {
  const name = input.name.trim();
  if (name === '') return { ok: false, error: 'Name the supply, like Zonrox bleach.' };
  if (name.length > 60) return { ok: false, error: 'Keep the name under 60 letters.' };
  const size = parseNumber(input.packSize, SUPPLY_LIMIT, 'bottle size');
  if (!size.ok) return size;
  if (size.value <= 0) return { ok: false, error: 'The bottle size must be more than 0.' };
  const cost = parseNumber(input.packCost, SUPPLY_LIMIT, 'price');
  if (!cost.ok) return cost;
  return { ok: true, value: { name, unit: input.unit, pack_size: size.value, pack_cost: cost.value, addon_id: input.addonId } };
}

/** How much of a supply one unit uses. Blank or 0 means it uses none. */
export function parseAmount(text: string): Parsed<number> {
  if (text.trim() === '') return { ok: true, value: 0 };
  return parseNumber(text, AMOUNT_LIMIT, 'amount');
}

/** "₱0.12 per ml", to the centavo, or finer when a ml costs under a centavo. */
export function formatUnitCost(supply: Pick<Supply, 'pack_size' | 'pack_cost' | 'unit'>): string {
  const each = costPerUnit(supply);
  const shown = each > 0 && each < 0.1 ? each.toFixed(4) : each.toFixed(2);
  return `₱${shown} per ${SUPPLY_UNIT_LABEL[supply.unit].replace(/s$/, '')}`;
}
