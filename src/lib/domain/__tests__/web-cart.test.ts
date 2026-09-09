import {
  EMPTY_CART,
  adjustLine,
  cartCount,
  cartItems,
  cartLines,
  cartTotal,
  startingCart,
  setLine,
  type CartService,
} from '../web-cart';
import { MAX_WEIGHT_KG } from '../booking-estimate';

const wash: CartService = { id: 'wash', name: 'Wash & fold', unit: 'per_kg', price: 60, min_quantity: 3 };
const shirt: CartService = { id: 'shirt', name: 'Shirt press', unit: 'per_item', price: 25, min_quantity: 0 };
const pickup: CartService = { id: 'pickup', name: 'Pickup fee', unit: 'flat', price: 50, min_quantity: 0 };
const catalog = [wash, shirt, pickup];

describe('adjustLine', () => {
  it('starts a per-kg line at the shop minimum, never at one stray kilo', () => {
    expect(adjustLine(EMPTY_CART, wash, 1)).toEqual({ wash: 3 });
  });

  it('starts a per-item line at one piece', () => {
    expect(adjustLine(EMPTY_CART, shirt, 1)).toEqual({ shirt: 1 });
  });

  it('adds a kilo at a time once the line exists', () => {
    expect(adjustLine({ wash: 3 }, wash, 1)).toEqual({ wash: 4 });
  });

  it('never exceeds the booking weight cap', () => {
    expect(adjustLine({ wash: MAX_WEIGHT_KG }, wash, 1)).toEqual({ wash: MAX_WEIGHT_KG });
  });

  it('removes a per-kg line that would drop below the minimum', () => {
    expect(adjustLine({ wash: 3, shirt: 2 }, wash, -1)).toEqual({ shirt: 2 });
  });

  it('removes a per-item line at zero', () => {
    expect(adjustLine({ shirt: 1 }, shirt, -1)).toEqual({});
  });

  it('treats a flat service as on or off', () => {
    const on = adjustLine(EMPTY_CART, pickup, 1);
    expect(on).toEqual({ pickup: 1 });
    expect(adjustLine(on, pickup, 1)).toEqual({ pickup: 1 });
    expect(adjustLine(on, pickup, -1)).toEqual({});
  });

  it('does not mutate the cart it was given', () => {
    const before = { wash: 3 };
    adjustLine(before, wash, 1);
    expect(before).toEqual({ wash: 3 });
  });
});

describe('cartLines', () => {
  it('prices every line in catalog order and drops ids the shop no longer sells', () => {
    const lines = cartLines({ shirt: 2, wash: 4, gone: 1 }, catalog);
    expect(lines.map((line) => [line.service.id, line.quantity, line.subtotal])).toEqual([
      ['wash', 4, 240],
      ['shirt', 2, 50],
    ]);
  });

  it('sums the lines', () => {
    expect(cartTotal(cartLines({ wash: 4, shirt: 2, pickup: 1 }, catalog))).toBe(340);
  });

  it('bills a below-minimum quantity at the minimum, as the server will', () => {
    expect(cartLines({ wash: 2 }, catalog)[0].subtotal).toBe(180);
  });
});

describe('cartItems and cartCount', () => {
  it('shapes the cart for place_order', () => {
    expect(cartItems({ wash: 4, shirt: 2 })).toEqual([
      { serviceId: 'wash', quantity: 4 },
      { serviceId: 'shirt', quantity: 2 },
    ]);
  });

  it('counts lines, not pieces', () => {
    expect(cartCount({ wash: 4, shirt: 2 })).toBe(2);
    expect(cartCount(EMPTY_CART)).toBe(0);
  });
});

describe('startingCart', () => {
  it('opens the basket with the tapped service at its starting quantity', () => {
    expect(startingCart('wash', catalog)).toEqual({ wash: 3 });
    expect(startingCart('shirt', catalog)).toEqual({ shirt: 1 });
  });

  it('takes the first id when the router repeats the key', () => {
    expect(startingCart(['shirt', 'wash'], catalog)).toEqual({ shirt: 1 });
  });

  it('opens empty for no id, or an id the shop no longer sells', () => {
    expect(startingCart(undefined, catalog)).toBe(EMPTY_CART);
    expect(startingCart('', catalog)).toBe(EMPTY_CART);
    expect(startingCart('gone', catalog)).toBe(EMPTY_CART);
  });
});

describe('setLine', () => {
  const KILOS = { id: 'wf', name: 'Wash & Fold', unit: 'per_kg' as const, price: 40, min_quantity: 3 };

  it('stores exactly what the scale was dragged to', () => {
    expect(setLine({}, KILOS, 7)).toEqual({ wf: 7 });
  });

  it('drops the line at zero, rather than keeping an empty one', () => {
    expect(setLine({ wf: 7 }, KILOS, 0)).toEqual({});
  });

  it('never keeps a negative weight', () => {
    expect(setLine({ wf: 7 }, KILOS, -2)).toEqual({});
  });

  it('lets the customer sit below the minimum, and says so elsewhere', () => {
    // The app's scale does the same: it stores 1 kg against a 3 kg minimum and
    // lets minimumChargeNotice explain the charge. Snapping the ruler back
    // under the finger is the worse answer.
    expect(setLine({}, KILOS, 1)).toEqual({ wf: 1 });
  });

  it('leaves the rest of the basket alone', () => {
    expect(setLine({ other: 2 }, KILOS, 5)).toEqual({ other: 2, wf: 5 });
  });
});
