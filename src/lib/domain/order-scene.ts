/**
 * What to draw for an order, and what to say over it.
 *
 * A status badge tells a customer the name of a state. A picture of that state
 * tells them what is happening to their clothes, which is the thing they
 * actually wanted to know. The scenes are the ones the price list already
 * draws — `service-scene.tsx` — plus one the shopfront never needed: a rider,
 * for the only stage where the laundry is not in the shop.
 *
 * Chosen here rather than in the screen so the app, the web page and the tests
 * cannot drift into disagreeing about what a drying order looks like.
 */
import type { OrderStatus } from './order-status';
import type { Fulfillment } from './walk-in-order';

/** Every scene an order can wear. The first four are the price list's own. */
export const ORDER_SCENES = ['basket', 'machine', 'stack', 'scooter'] as const;

export type OrderScene = (typeof ORDER_SCENES)[number];

/**
 * The picture for this moment in the order.
 *
 * `scooter` is the one fulfillment actually changes: a customer walking to the
 * shop for their own laundry should not be shown a rider on his way to them.
 */
export function orderScene(status: OrderStatus, fulfillment: Fulfillment): OrderScene {
  switch (status) {
    case 'pending':
    case 'received':
      return 'basket';
    case 'washing':
    case 'drying':
      return 'machine';
    case 'ready':
      return fulfillment === 'delivery' ? 'scooter' : 'stack';
    case 'folded':
    case 'completed':
    case 'cancelled':
    default:
      return 'stack';
  }
}

/**
 * The picture on the slip a customer gets the moment they book.
 *
 * Not `orderScene`: that draws where the laundry *is*, and on a slip printed
 * one second after booking the honest answer is "nowhere yet" — a basket on a
 * counter nobody has walked to. What a customer wants at that moment is what
 * happens next, and what happens next is the whole difference between the two
 * ways of using the shop: a rider comes to you, or you go to the shop.
 */
export function placedScene(fulfillment: Fulfillment): OrderScene {
  return fulfillment === 'delivery' ? 'scooter' : 'basket';
}

/**
 * The line on the slip a customer gets the moment they book.
 *
 * Not "Order placed" and not "Success". The shop has just taken work on for
 * them, and the first thing a counter says when it does is thank you.
 */
export function placedTitle(): string {
  return 'Thank you!';
}

/** What happens next, in the one sentence under the title. */
export function placedNote(fulfillment: Fulfillment): string {
  return fulfillment === 'delivery'
    ? 'The shop will collect your laundry and bring it back to you.'
    : 'Drop your laundry at the shop and they will take it from there.';
}
