import type { OrderType } from './order-tags';

/**
 * The parts of an order that say who to call about it. Kept structural so both
 * a freshly placed `OrderRow` and a joined `OrderWithDetails` satisfy it.
 */
export interface ContactableOrder {
  order_type: OrderType;
  /** The account the order belongs to; null for an unclaimed walk-in. */
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
}

export interface OrderContact {
  /** What the shop reads on the card — never blank. */
  name: string;
  /** Dialable number, or null when the order carries none. */
  phone: string | null;
  /** False when `name` is a stand-in rather than a person's actual name. */
  isNamed: boolean;
}

/**
 * A customer who books in the app never types their name at a counter, so the
 * shop used to see "Walk-in customer" with no number against an order placed by
 * someone they could have rung. `place_order` now stamps the booker's own
 * profile onto the order (migration 0015); this keeps the *fallback* honest for
 * the rows that still carry nothing — an order with an account behind it is not
 * a walk-in, and saying so sends the shop looking for a face at the counter.
 */
export function orderContact(order: ContactableOrder): OrderContact {
  const name = order.customer_name.trim();
  const phone = order.customer_phone.trim();

  return {
    name: name || placeholderName(order),
    phone: phone || null,
    isNamed: name.length > 0,
  };
}

function placeholderName(order: ContactableOrder): string {
  if (order.order_type === 'online') return 'Online customer';
  return order.customer_id ? 'App customer' : 'Walk-in customer';
}
