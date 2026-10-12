import {
  MAX_PIECES,
  checkLineSubtotal,
  checkTotal,
  isKgLine,
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

describe('a line with a weight table', () => {
  const pack = {
    itemId: 'i1',
    name: 'Package 1 Wash Dry Fold',
    unit: 'flat' as const,
    unitPrice: 185,
    minQuantity: 0,
    bookedQuantity: 9,
    weightPrices: [
      { up_to_kg: 8, price: 185 },
      { up_to_kg: 9, price: 215 },
      { up_to_kg: 10, price: 300 },
    ],
  };

  test('is entered as kilos and priced by its band, not as pieces', () => {
    expect(isKgLine(pack)).toBe(true);
    expect(checkLineSubtotal(pack, 9)).toBe(215);
    expect(checkLineSubtotal(pack, 9.5)).toBe(300);
    expect(quantityError(pack, 8.5)).toBeNull();
  });
});

describe('a line sold per load', () => {
  const fullService: CheckLine = {
    itemId: 'i-load',
    name: 'Full Service',
    unit: 'flat',
    unitPrice: 165,
    minQuantity: 0,
    bookedQuantity: 16,
    loadKg: 8,
  };

  test('is weighed on the scale', () => {
    expect(isKgLine(fullService)).toBe(true);
    expect(quantityError(fullService, 8.5)).toBeNull();
  });

  test('is charged once per load the weight fills', () => {
    expect(checkLineSubtotal(fullService, 8)).toBe(165);
    expect(checkLineSubtotal(fullService, 16)).toBe(330);
    expect(checkLineSubtotal(fullService, 16.5)).toBe(495);
  });
});
