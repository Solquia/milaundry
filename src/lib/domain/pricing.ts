import { priceForWeight, readWeightPrices, type WeightPrice } from './weight-prices';

export type PricingUnit = 'per_kg' | 'per_item' | 'flat';

export interface Service {
  id: string;
  name: string;
  unit: PricingUnit;
  price: number;
  /** Minimum billable quantity (e.g. 5 kg minimum). 0/absent = no minimum. */
  min_quantity?: number;
  /** Most a single load may weigh, in kg. 0/absent = no limit. A flat price is charged per load. */
  max_quantity?: number;
  /** The menu section; `special_items` reads a load limit as a limit on each piece. */
  category?: string;
  /** A price per weight band (0043). When set, it prices the line by its kilos. */
  weight_prices?: readonly WeightPrice[];
}

type PricedService = Pick<Service, 'unit' | 'max_quantity' | 'category' | 'weight_prices'>;

/** Whether the shop's own weight table sets this service's price. */
export function hasWeightTable(service: Pick<Service, 'weight_prices'>): boolean {
  return readWeightPrices(service.weight_prices).length > 0;
}

/**
 * Whether the customer books this by weight: per kilo, by a weight table, or
 * a flat price sold per load (a load limit set). Everything else is counted
 * in pieces.
 *
 * Bedding is the exception: a flat comforter "max 4 kg" is a limit on each
 * piece, not a load, so it stays counted.
 */
export function isWeighed(service: PricedService): boolean {
  if (service.unit === 'per_kg') return true;
  if (service.category === 'special_items') return false;
  if (service.unit === 'flat' && hasWeightTable(service)) return true;
  return service.unit === 'flat' && (service.max_quantity ?? 0) > 0;
}

/**
 * A flat price sold per load: the weight is split into loads at the shop's
 * limit. A weight table outranks it, so a tabled service is never per load.
 */
export function isPerLoad(service: PricedService): boolean {
  return service.unit === 'flat' && !hasWeightTable(service) && isWeighed(service);
}

/**
 * Whole loads for a weight at the service's load limit: 16 kg at 8 kg a load
 * is 2, 16.5 kg is 3. `public.load_count` does the same on the server.
 */
export function loadsFor(service: Pick<Service, 'max_quantity'>, kg: number): number {
  const limit = service.max_quantity ?? 0;
  if (!Number.isFinite(kg) || kg <= 0 || !(limit > 0)) return 0;
  return Math.max(1, Math.ceil(kg / limit - 1e-9));
}

export interface OrderItemInput {
  serviceId: string;
  quantity: number;
}

export interface OrderEstimateLine {
  serviceId: string;
  subtotal: number;
}

export interface OrderEstimate {
  lines: OrderEstimateLine[];
  total: number;
}

const roundMoney = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export function estimateLineTotal(service: Service, quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`Invalid quantity: ${quantity}`);
  }
  // A weight table outranks the unit: the band the load falls in is the price.
  const byWeight = priceForWeight(readWeightPrices(service.weight_prices), quantity);
  if (byWeight !== null) return roundMoney(byWeight);
  if (isPerLoad(service)) return roundMoney(service.price * loadsFor(service, quantity));
  if (service.unit === 'flat') {
    return roundMoney(service.price);
  }
  const billableQuantity = Math.max(quantity, service.min_quantity ?? 0);
  return roundMoney(service.price * billableQuantity);
}

export function estimateOrderTotal(
  catalog: readonly Service[],
  items: readonly OrderItemInput[]
): OrderEstimate {
  const byId = new Map(catalog.map((s) => [s.id, s]));

  const lines = items.map((item) => {
    const service = byId.get(item.serviceId);
    if (!service) {
      throw new Error(`Unknown service: ${item.serviceId}`);
    }
    return { serviceId: item.serviceId, subtotal: estimateLineTotal(service, item.quantity) };
  });

  const total = roundMoney(lines.reduce((sum, line) => sum + line.subtotal, 0));
  return { lines, total };
}
