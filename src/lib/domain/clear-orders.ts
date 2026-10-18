/**
 * Which orders the "Clear test orders" sheet lists: the ones taken in the
 * period the analytics screen is showing, newest first, so the owner finds
 * the test runs they made while setting up next to the figures they skew.
 */
interface ClearableOrder {
  created_at: string;
}

export function ordersTakenIn<T extends ClearableOrder>(
  orders: readonly T[],
  frame: { start: number; end: number },
): T[] {
  return orders
    .filter((order) => {
      const at = new Date(order.created_at).getTime();
      return at >= frame.start && at < frame.end;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
