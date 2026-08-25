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
