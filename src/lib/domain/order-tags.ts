import type { OrderStatus } from './order-status';
import type { Fulfillment } from './walk-in-order';

export type OrderType = 'walk_in' | 'online';
export type PaymentStatus = 'unpaid' | 'paid';

export interface TaggableOrder {
  order_type: OrderType;
  fulfillment: Fulfillment;
  payment_status: PaymentStatus;
  status: OrderStatus;
}

/** Display tags for an order card: origin, fulfillment, and payment state. */
export function orderTags(order: TaggableOrder): string[] {
  const tags = [
    order.order_type === 'walk_in' ? 'Walk-in' : 'Online',
    order.fulfillment === 'delivery' ? 'Delivery' : 'Pickup',
  ];
  if (order.status !== 'cancelled') {
    tags.push(order.payment_status === 'paid' ? 'Paid' : 'Unpaid');
  }
  return tags;
}
