import { bookButtonLabel, lineSummary } from '../basket-copy';
import type { CartLine } from '../web-cart';

const washLine: CartLine = {
  service: { id: 'wash', name: 'Wash and fold', unit: 'per_kg', price: 176, min_quantity: 2 },
  quantity: 3,
  subtotal: 528,
};
const shirtLine: CartLine = {
  service: { id: 'shirt', name: 'Shirt press', unit: 'per_item', price: 25, min_quantity: 0 },
  quantity: 1,
  subtotal: 25,
};
const flatLine: CartLine = {
  service: { id: 'pickup', name: 'Pickup', unit: 'flat', price: 50, min_quantity: 0 },
  quantity: 1,
  subtotal: 50,
};

describe('bookButtonLabel', () => {
  it('invites a booking while the basket is empty', () => {
    expect(bookButtonLabel(0, 0)).toBe('Book online');
  });

  it('carries the count and the total once something is in the basket', () => {
    expect(bookButtonLabel(1, 528)).toBe('Book 1 item · ₱528');
    expect(bookButtonLabel(2, 553.5)).toBe('Book 2 items · ₱553.50');
  });
});

describe('lineSummary', () => {
  it('reads the line back as money for a quantity', () => {
    expect(lineSummary(washLine)).toBe('₱528 for 3 kg');
    expect(lineSummary(shirtLine)).toBe('₱25 for 1 piece');
  });

  it('says only the price for a flat line, which has no quantity to speak of', () => {
    expect(lineSummary(flatLine)).toBe('₱50');
  });
});
