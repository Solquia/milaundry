/**
 * The market storefront's basket as screen state: the cart, the one-line
 * notice when a load was swapped, and the figures the basket bar shows. The
 * app's shop screen and the shop's web page both hold their basket here, so
 * "+" means the same on both. The rules are `domain/market-cart`.
 */
import { useState } from 'react';

import {
  EMPTY_CART,
  addToCart,
  cartBooking,
  cartCount,
  cartEstimate,
  cartLines,
  decodeCart,
  encodeCart,
  isLoad,
  pruneCart,
  removeFromCart,
  type Cart,
  type CartService,
} from './domain/market-cart';

/**
 * `returned` is the basket as the checkout's "Edit" handed it back in the
 * link. The page may already be open underneath the checkout, so a new one
 * replaces what it held: the link is the newer word on what is in the basket.
 */
export function useMarketCart<T extends CartService>(
  services: readonly T[],
  returned?: string | string[]
) {
  const param = Array.isArray(returned) ? returned[0] : returned;
  const [cart, setCart] = useState<Cart>(() => (param ? decodeCart(param) : EMPTY_CART));
  const [notice, setNotice] = useState<string | null>(null);

  // A new link replaces the basket; adjusted while rendering, the way React
  // resets state from a changed prop, rather than in an effect a frame late.
  const [seenParam, setSeenParam] = useState(param);
  if (param !== seenParam) {
    setSeenParam(param);
    if (param) setCart(decodeCart(param));
  }

  const add = (service: T) => {
    const result = addToCart(cart, service, services);
    setCart(result.cart);
    setNotice(
      result.swappedOut
        ? `Swapped for ${service.name} · 1 load per order`
        : null
    );
  };

  const remove = (serviceId: string) => {
    setCart((prev) => removeFromCart(prev, serviceId));
    setNotice(null);
  };

  return {
    notice,
    add,
    remove,
    cart: pruneCart(cart, services),
    count: cartCount(cart, services),
    estimate: cartEstimate(cart, services),
    isFromPrice: cartLines(cart, services).some((line) => isLoad(line.service)),
    booking: cartBooking(cart, services),
    encoded: encodeCart(cart),
  };
}
