import type { OrderStatus } from './order-status';
import type { OrderType, PaymentStatus } from './order-tags';

export interface BookingPaymentInput {
  status: OrderStatus;
  order_type: OrderType;
  payment_status: PaymentStatus;
  final_total: number | null;
}

export type BookingPaymentStage =
  | 'awaiting_price' // booked; shop hasn't weighed & confirmed yet
  | 'price_confirmed' // actual price set; customer picks how to pay
  | 'paid'
  | 'none'; // walk-in or cancelled — no online payment journey

/** Where an online booking sits in the price-confirmation → payment journey. */
export function bookingPaymentStage(order: BookingPaymentInput): BookingPaymentStage {
  if (order.order_type !== 'online' || order.status === 'cancelled') return 'none';
  if (order.payment_status === 'paid') return 'paid';
  if (order.final_total === null) return 'awaiting_price';
  return 'price_confirmed';
}

/** The customer may pick a payment method only once the price is confirmed. */
export function canChoosePayment(order: BookingPaymentInput): boolean {
  return bookingPaymentStage(order) === 'price_confirmed';
}
