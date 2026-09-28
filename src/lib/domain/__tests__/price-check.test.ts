import {
  MAX_PIECES,
  checkLineSubtotal,
  checkTotal,
  quantityError,
  type CheckLine,
} from '../price-check';

const kg: CheckLine = {
  itemId: 'k',
  name: 'Wash & Fold',
  unit: 'per_kg',
  unitPrice: 35,
  minQuantity: 5,
  bookedQuantity: 6,
};
const comforter: CheckLine = {
  itemId: 'c',
  name: 'Comforter',
  unit: 'flat',
  unitPrice: 200,
  minQuantity: 0,
  bookedQuantity: 1,
};
const detergent: CheckLine = {
  itemId: 'd',
  name: 'Detergent',
  unit: 'flat',
  unitPrice: 15,
  minQuantity: 0,
  bookedQuantity: 1,
};

describe('checkLineSubtotal', () => {
  it('prices a weighed line from the scale, never under its minimum', () => {
    expect(checkLineSubtotal(kg, 7.5)).toBe(262.5);
    expect(checkLineSubtotal(kg, 3)).toBe(175);
  });

  it('prices a counted line by the piece, at the price the customer booked', () => {
    expect(checkLineSubtotal(comforter, 2)).toBe(400);
  });

  it('prices a piece the customer did not bring at nothing', () => {
    expect(checkLineSubtotal(comforter, 0)).toBe(0);
  });
});

describe('checkTotal', () => {
  it('uses the booked quantity for any line the counter did not change', () => {
    expect(checkTotal([comforter, detergent], {})).toBe(215);
  });

  it('adds up the corrected lines', () => {
    expect(checkTotal([kg, comforter, detergent], { k: 8, c: 2 })).toBe(280 + 400 + 15);
  });

  it('rounds to centavos', () => {
    expect(checkTotal([{ ...kg, unitPrice: 33.33, minQuantity: 0 }], { k: 1.1 })).toBe(36.66);
  });
});

describe('quantityError', () => {
  it('wants a real reading for a weighed line', () => {
    expect(quantityError(kg, 0)).toMatch(/weight/i);
    expect(quantityError(kg, 101)).toMatch(/100 kg/);
    expect(quantityError(kg, 7.5)).toBeNull();
  });

  it('wants whole pieces, and allows none', () => {
    expect(quantityError(comforter, 1.5)).toMatch(/whole/i);
    expect(quantityError(comforter, 0)).toBeNull();
    expect(quantityError(comforter, MAX_PIECES + 1)).not.toBeNull();
  });
});
