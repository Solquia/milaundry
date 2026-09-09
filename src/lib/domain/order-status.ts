export const ORDER_STATUSES = [
  'pending',
  'received',
  'washing',
  'drying',
  'folded',
  'ready',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TERMINAL_STATUSES: readonly OrderStatus[] = ['completed', 'cancelled'];

const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ['received', 'cancelled'],
  received: ['washing', 'cancelled'],
  washing: ['drying', 'cancelled'],
  drying: ['folded', 'cancelled'],
  folded: ['ready', 'cancelled'],
  ready: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return [...TRANSITIONS[from]];
}

/**
 * What the button that moves an order to `to` should say.
 *
 * A badge names a state ("Washing"); a button names what pressing it does.
 * The screen used to build "Mark as {state}" for both, which produced things
 * like "Mark as In the shop". These are the words an owner would use about the
 * step they have just finished.
 */
const ADVANCE_LABELS: Record<OrderStatus, string> = {
  pending: 'Not started',
  received: 'Laundry received',
  washing: 'Start washing',
  drying: 'Start drying',
  folded: 'Done folding',
  ready: 'Ready for pickup',
  completed: 'Handed to customer',
  cancelled: 'Cancel this order',
};

export function advanceActionLabel(to: OrderStatus): string {
  return ADVANCE_LABELS[to];
}

/**
 * Where the laundry is, said the way an owner would say it across the counter.
 * "Pending" and "Received" were ambiguous — received what, the laundry or the
 * money? — and "Delivered / picked up" made a badge carry a slash.
 *
 * Lives here rather than in the UI kit so pure logic (the orders board's
 * spoken card label) can name a status without importing React Native.
 */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Not started',
  received: 'In the shop',
  washing: 'Washing',
  drying: 'Drying',
  folded: 'Folded',
  ready: 'Ready for pickup',
  completed: 'Done',
  cancelled: 'Cancelled',
};
