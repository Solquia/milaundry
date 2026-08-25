export type PricingUnit = 'per_kg' | 'per_item' | 'flat';

export interface Service {
  id: string;
  name: string;
  unit: PricingUnit;
  price: number;
  /** Minimum billable quantity (e.g. 5 kg minimum). 0/absent = no minimum. */
  min_quantity?: number;
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
