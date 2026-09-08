/**
 * Where the laundry is, for someone following it in a browser.
 *
 * The app shows a status badge and leaves the rest to the order history. A
 * customer who booked from a web page with no app has only this page, so it
 * says the whole path: what has happened, what is happening, what is next.
 */
import { ORDER_STATUSES, type OrderStatus } from './order-status';
import type { Fulfillment } from './walk-in-order';

export type TrackingState = 'done' | 'current' | 'upcoming';

export interface TrackingStep {
  status: OrderStatus;
  label: string;
  state: TrackingState;
}

/** The path every order walks; cancelled is a departure from it, not a step. */
const PATH: readonly OrderStatus[] = ORDER_STATUSES.filter((status) => status !== 'cancelled');

function stepLabel(status: OrderStatus, fulfillment: Fulfillment): string {
  const isDelivery = fulfillment === 'delivery';
  switch (status) {
    case 'pending':
      return 'Booked';
    case 'received':
      return 'At the shop';
    case 'washing':
      return 'Washing';
    case 'drying':
      return 'Drying';
    case 'folded':
      return 'Folded';
    case 'ready':
      return isDelivery ? 'Out for delivery' : 'Ready for pickup';
    case 'completed':
      return isDelivery ? 'Delivered' : 'Picked up';
    default:
      return 'Cancelled';
  }
}

/** The steps with their state; empty for a cancelled order. */
export function trackingSteps(status: OrderStatus, fulfillment: Fulfillment): TrackingStep[] {
  if (status === 'cancelled') return [];
  // A finished order has nothing current: the last step is done, not in hand.
  const position = status === 'completed' ? PATH.length : PATH.indexOf(status);
  return PATH.map((step, index) => ({
    status: step,
    label: stepLabel(step, fulfillment),
    state: index < position ? 'done' : index === position ? 'current' : 'upcoming',
  }));
}

/** The one line at the top of the tracking page. */
export function trackingHeadline(status: OrderStatus, fulfillment: Fulfillment): string {
  const isDelivery = fulfillment === 'delivery';
  switch (status) {
    case 'pending':
      return 'Your booking is in';
    case 'received':
      return 'Your laundry is at the shop';
    case 'washing':
      return 'Your laundry is being washed';
    case 'drying':
      return 'Your laundry is drying';
    case 'folded':
      return 'Your laundry is folded';
    case 'ready':
      return isDelivery ? 'Your laundry is on its way' : 'Your laundry is ready for pickup';
    case 'completed':
      return 'All done';
    default:
      return 'This order was cancelled';
  }
}
