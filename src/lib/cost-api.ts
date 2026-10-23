/**
 * The owner's costs: free supplies, how much of each a service uses, and what
 * services and orders cost the shop (0051). Every call here is owner-only in
 * the database; a staff session is refused.
 */
import type {
  OrderLineCost,
  PeriodOrderCost,
  ServiceCostRow,
  ServiceSupply,
  Supply,
  SupplyDraft,
} from './domain/service-costs';
import { supabase } from './supabase';

type Numeric = number | string | null;

const toNumber = (value: Numeric) => (value === null ? null : Number(value));

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function getSupplies(shopId: string): Promise<Supply[]> {
  const { data, error } = await supabase
    .from('shop_supplies')
    .select('id, shop_id, name, unit, pack_size, pack_cost, addon_id')
    .eq('shop_id', shopId)
    .order('name');
  check(error);
  return ((data ?? []) as (Supply & { pack_size: Numeric; pack_cost: Numeric })[]).map((row) => ({
    ...row,
    pack_size: Number(row.pack_size),
    pack_cost: Number(row.pack_cost),
  }));
}

export async function addSupply(shopId: string, draft: SupplyDraft): Promise<void> {
  const { error } = await supabase.from('shop_supplies').insert({ shop_id: shopId, ...draft });
  check(error);
}

export async function updateSupply(supplyId: string, draft: SupplyDraft): Promise<void> {
  const { error } = await supabase.from('shop_supplies').update(draft).eq('id', supplyId);
  check(error);
}

/** Removes the supply and its place in every service that used it. */
export async function deleteSupply(supplyId: string): Promise<void> {
  const { error } = await supabase.from('shop_supplies').delete().eq('id', supplyId);
  check(error);
}

/** Every service's supplies in this shop. */
export async function getServiceSupplies(shopId: string): Promise<ServiceSupply[]> {
  const { data, error } = await supabase
    .from('service_supplies')
    .select('service_id, supply_id, amount, shop_supplies!inner(shop_id)')
    .eq('shop_supplies.shop_id', shopId);
  check(error);
  return ((data ?? []) as { service_id: string; supply_id: string; amount: Numeric }[]).map((row) => ({
    service_id: row.service_id,
    supply_id: row.supply_id,
    amount: Number(row.amount),
  }));
}

/**
 * Replaces one service's supplies with `lines`; a supply left out, or at 0,
 * is one the service no longer uses.
 */
export async function setServiceSupplies(
  serviceId: string,
  lines: readonly { supply_id: string; amount: number }[]
): Promise<void> {
  const kept = lines.filter((line) => line.amount > 0);
  const dropped = lines.filter((line) => line.amount <= 0).map((line) => line.supply_id);
  if (kept.length > 0) {
    const { error } = await supabase
      .from('service_supplies')
      .upsert(kept.map((line) => ({ service_id: serviceId, ...line })));
    check(error);
  }
  if (dropped.length > 0) {
    const { error } = await supabase
      .from('service_supplies')
      .delete()
      .eq('service_id', serviceId)
      .in('supply_id', dropped);
    check(error);
  }
}

export async function getServiceCosts(shopId: string, days: number): Promise<ServiceCostRow[]> {
  const { data, error } = await supabase.rpc('get_service_costs', { p_shop_id: shopId, p_days: days });
  check(error);
  return (
    (data ?? []) as {
      service_id: string;
      unit_cost: Numeric;
      units_recent: Numeric;
      revenue_recent: Numeric;
      cost_recent: Numeric;
    }[]
  ).map((row) => ({
    service_id: row.service_id,
    unit_cost: toNumber(row.unit_cost),
    units_recent: Number(row.units_recent ?? 0),
    revenue_recent: Number(row.revenue_recent ?? 0),
    cost_recent: toNumber(row.cost_recent),
  }));
}

export async function getOrderCosts(orderId: string): Promise<OrderLineCost[]> {
  const { data, error } = await supabase.rpc('get_order_costs', { p_order_id: orderId });
  check(error);
  return ((data ?? []) as { item_id: string; cost: Numeric }[]).map((row) => ({
    item_id: row.item_id,
    cost: toNumber(row.cost),
  }));
}

/** Every order taken in a window: its supplies and products cost, and who took it (0054). */
export async function getPeriodOrderCosts(
  shopId: string,
  from: number,
  to: number
): Promise<PeriodOrderCost[]> {
  const { data, error } = await supabase.rpc('get_period_order_costs', {
    p_shop_id: shopId,
    p_from: new Date(from).toISOString(),
    p_to: new Date(to).toISOString(),
  });
  check(error);
  return (
    (data ?? []) as {
      order_id: string;
      cost: Numeric;
      lines: number;
      costed_lines: number;
      taken_by: string | null;
    }[]
  ).map((row) => ({
    orderId: row.order_id,
    cost: toNumber(row.cost),
    lines: row.lines,
    costedLines: row.costed_lines,
    takenBy: row.taken_by,
  }));
}
