import {
  EMPTY_CART,
  addToCart,
  bookingToCart,
  cartBooking,
  cartCount,
  cartEstimate,
  cartLines,
  decodeCart,
  encodeCart,
  pruneCart,
  removeFromCart,
  type CartService,
} from '../market-cart';

const washFold: CartService = {
  id: 's-wash', name: 'Wash & Fold', unit: 'per_kg', price: 35, min_quantity: 5, max_quantity: 0, category: 'wash_fold',
};
const washDry: CartService = {
  id: 's-dry', name: 'Wash-Dry', unit: 'flat', price: 150, min_quantity: 0, max_quantity: 6, category: 'wash_fold',
};
const comforter: CartService = {
  id: 's-comf', name: 'Comforter', unit: 'flat', price: 200, min_quantity: 0, max_quantity: 0, category: 'special_items',
};
const shirt: CartService = {
  id: 's-shirt', name: 'Barong press', unit: 'per_item', price: 60, min_quantity: 0, max_quantity: 0, category: 'ironing',
};
const catalog = [washFold, washDry, comforter, shirt];

describe('addToCart', () => {
  it('adds a piece at a time', () => {
    const once = addToCart(EMPTY_CART, shirt, catalog).cart;
    const twice = addToCart(once, shirt, catalog).cart;
    expect(twice).toEqual({ 's-shirt': 2 });
  });

  it('does not change the cart it was given', () => {
    const cart = { 's-shirt': 1 };
    addToCart(cart, shirt, catalog);
    expect(cart).toEqual({ 's-shirt': 1 });
  });

  it('holds a load at one: the weight is picked at checkout', () => {
    const once = addToCart(EMPTY_CART, washFold, catalog).cart;
    expect(addToCart(once, washFold, catalog).cart).toEqual({ 's-wash': 1 });
  });

  it('swaps one load for another and says which went', () => {
    const withWash = addToCart({ 's-shirt': 2 }, washFold, catalog).cart;
    const result = addToCart(withWash, washDry, catalog);
    expect(result.cart).toEqual({ 's-shirt': 2, 's-dry': 1 });
    expect(result.swappedOut).toBe('Wash & Fold');
  });

  it('says nothing was swapped when nothing was', () => {
    expect(addToCart(EMPTY_CART, washFold, catalog).swappedOut).toBeNull();
  });

  it('stops pieces at the booking limit', () => {
    let cart = EMPTY_CART;
    for (let i = 0; i < 20; i += 1) cart = addToCart(cart, comforter, catalog).cart;
    expect(cart['s-comf']).toBe(12);
  });
});

describe('removeFromCart', () => {
  it('takes one piece off and drops the line at zero', () => {
    expect(removeFromCart({ 's-shirt': 2 }, 's-shirt')).toEqual({ 's-shirt': 1 });
    expect(removeFromCart({ 's-shirt': 1 }, 's-shirt')).toEqual({});
  });

  it('ignores a service that is not in the cart', () => {
    expect(removeFromCart({ 's-shirt': 1 }, 's-wash')).toEqual({ 's-shirt': 1 });
  });
});

describe('cartCount / cartLines', () => {
  const cart = { 's-shirt': 3, 's-wash': 1, gone: 2 };

  it('counts a load as one and pieces by the piece', () => {
    expect(cartCount(cart, catalog)).toBe(4);
  });

  it('lists lines in menu order, skipping services the shop dropped', () => {
    expect(cartLines(cart, catalog).map((line) => line.service.id)).toEqual(['s-wash', 's-shirt']);
  });
});

describe('cartBooking', () => {
  it('opens the booking on the load, with pieces riding alongside', () => {
    const booking = cartBooking({ 's-shirt': 2, 's-comf': 1, 's-wash': 1 }, catalog);
    expect(booking).toEqual({
      serviceId: 's-wash',
      weightKg: 5,
      addOns: { 's-shirt': 2, 's-comf': 1 },
    });
  });

  it('starts a load with no minimum on the smallest size card, so one is picked', () => {
    // "Small bag · up to 3 kg": a size the customer can see chosen, not a bare 1 kg.
    expect(cartBooking({ 's-dry': 1 }, catalog)?.weightKg).toBe(3);
  });

  it('opens on a counted line when there is no load', () => {
    expect(cartBooking({ 's-comf': 2, 's-shirt': 3 }, catalog)).toEqual({
      serviceId: 's-shirt',
      weightKg: 3,
      addOns: { 's-comf': 2 },
    });
  });

  it('keeps extra flat pieces as their own lines when they are all there is', () => {
    expect(cartBooking({ 's-comf': 3 }, catalog)).toEqual({
      serviceId: 's-comf',
      weightKg: 1,
      addOns: { 's-comf': 2 },
    });
  });

  it('has nothing to book in an empty cart', () => {
    expect(cartBooking(EMPTY_CART, catalog)).toBeNull();
    expect(cartBooking({ gone: 1 }, catalog)).toBeNull();
  });
});

describe('cartEstimate', () => {
  it('prices the cart the way the booking will open', () => {
    // 5 kg minimum at 35, two pressed shirts at 60.
    expect(cartEstimate({ 's-wash': 1, 's-shirt': 2 }, catalog)).toBe(295);
  });

  it('bills a flat extra once per piece', () => {
    expect(cartEstimate({ 's-comf': 3 }, catalog)).toBe(600);
  });

  it('is null for an empty cart', () => {
    expect(cartEstimate(EMPTY_CART, catalog)).toBeNull();
  });
});

describe('encodeCart / decodeCart', () => {
  it('round-trips through a link', () => {
    const cart = { 's-wash': 1, 's-shirt': 3 };
    expect(decodeCart(encodeCart(cart))).toEqual(cart);
  });

  it('reads the first value when a param repeats', () => {
    expect(decodeCart(['s-shirt:2', 's-wash:1'])).toEqual({ 's-shirt': 2 });
  });

  it('drops anything malformed rather than guessing', () => {
    expect(decodeCart('s-shirt:2,bad,:3,s-x:0,s-y:-1,s-z:abc,s-w:2.5')).toEqual({ 's-shirt': 2 });
  });

  it('caps counts at the booking limit', () => {
    expect(decodeCart('s-shirt:999')).toEqual({ 's-shirt': 12 });
  });

  it('reads nothing from nothing', () => {
    expect(decodeCart(undefined)).toEqual({});
    expect(decodeCart('')).toEqual({});
  });
});

describe('bookingToCart', () => {
  it('turns a checkout back into the basket it came from', () => {
    expect(bookingToCart('s-wash', 8, { 's-shirt': 2, 's-comf': 1 }, catalog)).toEqual({
      's-wash': 1,
      's-shirt': 2,
      's-comf': 1,
    });
  });

  it('counts a piece line by its pieces and folds split flat pieces back together', () => {
    expect(bookingToCart('s-comf', 1, { 's-comf': 2 }, catalog)).toEqual({ 's-comf': 3 });
    expect(bookingToCart('s-shirt', 3, {}, catalog)).toEqual({ 's-shirt': 3 });
  });

  it('drops lines counted down to zero and services the shop no longer offers', () => {
    expect(bookingToCart('s-wash', 5, { 's-shirt': 0, gone: 2 }, catalog)).toEqual({ 's-wash': 1 });
  });

  it('round-trips with cartBooking', () => {
    const cart = { 's-wash': 1, 's-shirt': 2 };
    const booking = cartBooking(cart, catalog)!;
    expect(bookingToCart(booking.serviceId, booking.weightKg, booking.addOns, catalog)).toEqual(cart);
  });
});

describe('pruneCart', () => {
  it('keeps only what the shop still offers', () => {
    expect(pruneCart({ 's-shirt': 1, gone: 2 }, catalog)).toEqual({ 's-shirt': 1 });
  });
});
