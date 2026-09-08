import {
  EMPTY_CART,
  adjustLine,
  cartCount,
  cartItems,
  cartLines,
  cartTotal,
  cartFromParams,
  decodeCart,
  encodeCart,
  startingCart,
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

describe('encodeCart / decodeCart', () => {
  it('round-trips a basket through one query value', () => {
    const cart = { wash: 4, shirt: 2 };
    expect(decodeCart(encodeCart(cart), catalog)).toEqual(cart);
  });

  it('encodes nothing for an empty basket', () => {
    expect(encodeCart(EMPTY_CART)).toBe('');
  });

  it('drops lines the shop no longer sells and anything that is not a whole positive number', () => {
    expect(decodeCart('wash:3,gone:2,shirt:0,pickup:x', catalog)).toEqual({ wash: 3 });
  });

  it('holds a per-kg line to the shop minimum and the weight cap', () => {
    expect(decodeCart('wash:1', catalog)).toEqual({ wash: 3 });
    expect(decodeCart(`wash:${MAX_WEIGHT_KG + 50}`, catalog)).toEqual({ wash: MAX_WEIGHT_KG });
  });

  it('keeps a flat line at one', () => {
    expect(decodeCart('pickup:5', catalog)).toEqual({ pickup: 1 });
  });

  it('opens empty for a missing, blank, or nonsense value', () => {
    expect(decodeCart(undefined, catalog)).toBe(EMPTY_CART);
    expect(decodeCart('', catalog)).toBe(EMPTY_CART);
    expect(decodeCart('???', catalog)).toBe(EMPTY_CART);
  });
});

describe('cartFromParams', () => {
  it('prefers a whole basket over a single tapped service', () => {
    expect(cartFromParams({ cart: 'shirt:2', service: 'wash' }, catalog)).toEqual({ shirt: 2 });
  });

  it('falls back to the tapped service, then to empty', () => {
    expect(cartFromParams({ service: 'wash' }, catalog)).toEqual({ wash: 3 });
    expect(cartFromParams({}, catalog)).toBe(EMPTY_CART);
  });

  it('takes the first value when the router repeats a key', () => {
    expect(cartFromParams({ cart: ['shirt:1', 'wash:3'] }, catalog)).toEqual({ shirt: 1 });
  });
});
