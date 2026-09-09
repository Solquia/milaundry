import {
  formatPriceLine,
  formatQuantity,
  minimumChargeNotice,
  minimumLabel,
  priceSubtitle,
  unitCaption,
  unitSuffix,
} from '../price-label';
import type { Service } from '../pricing';

const curtains: Service = {
  id: 'curtains',
  name: 'Curtains',
  unit: 'per_kg',
  price: 60,
  min_quantity: 3,
};

const comforter: Service = {
  id: 'comforter',
  name: 'Comforter (queen / king, thick)',
  unit: 'per_item',
  price: 280,
  min_quantity: 0,
};

const selfService: Service = {
  id: 'self-wash',
  name: 'Self-service wash (per load)',
  unit: 'flat',
  price: 75,
  min_quantity: 0,
};

describe('unitSuffix', () => {
  it('labels each pricing unit with the same word on both sides of the app', () => {
    // The merchant price editor says "Per piece"; the customer screen used to
    // say "/item" for the same service. One word, one meaning.
    expect(unitSuffix('per_kg')).toBe('/kg');
    expect(unitSuffix('per_item')).toBe('/piece');
  });

  it('does not label a flat price as a per-piece price', () => {
    expect(unitSuffix('flat')).toBe(' flat');
  });
});

describe('formatQuantity', () => {
  it('keeps kilos as a unit, not a count', () => {
    expect(formatQuantity('per_kg', 3)).toBe('3 kg');
    expect(formatQuantity('per_kg', 0.5)).toBe('0.5 kg');
  });

  it('pluralises counted pieces', () => {
    expect(formatQuantity('per_item', 1)).toBe('1 piece');
    expect(formatQuantity('per_item', 2)).toBe('2 pieces');
  });
});

describe('formatPriceLine', () => {
  it('discloses a minimum in the price line', () => {
    expect(formatPriceLine(curtains)).toBe('₱60.00/kg · 3 kg minimum');
  });

  it('omits the minimum when there is none', () => {
    expect(formatPriceLine(comforter)).toBe('₱280.00/piece');
  });

  it('never claims a kilo minimum on a per-piece service', () => {
    const bulkTowels: Service = {
      id: 'towels',
      name: 'Towels',
      unit: 'per_item',
      price: 40,
      min_quantity: 2,
    };
    expect(formatPriceLine(bulkTowels)).toBe('₱40.00/piece · 2 pieces minimum');
  });

  it('shows a flat price without a unit or a minimum', () => {
    expect(formatPriceLine({ ...selfService, min_quantity: 5 })).toBe('₱75.00 flat');
  });
});

describe('minimumChargeNotice', () => {
  it('warns when the chosen quantity is billed up to the minimum', () => {
    // One tap on "+" for curtains adds ₱180, not ₱60 — say so before the total moves.
    expect(minimumChargeNotice(curtains, 1)).toBe(
      "3 kg minimum — you'll be billed for 3 kg (₱180.00)."
    );
  });

  it('pluralises the notice for counted pieces', () => {
    const bulkTowels: Service = {
      id: 'towels',
      name: 'Towels',
      unit: 'per_item',
      price: 40,
      min_quantity: 2,
    };
    expect(minimumChargeNotice(bulkTowels, 1)).toBe(
      "2 pieces minimum — you'll be billed for 2 pieces (₱80.00)."
    );
  });

  it('says nothing at or above the minimum', () => {
    expect(minimumChargeNotice(curtains, 3)).toBeNull();
    expect(minimumChargeNotice(curtains, 5)).toBeNull();
  });

  it('says nothing before the customer has chosen anything', () => {
    expect(minimumChargeNotice(curtains, 0)).toBeNull();
  });

  it('says nothing when the service has no minimum', () => {
    expect(minimumChargeNotice(comforter, 1)).toBeNull();
  });

  it('says nothing for flat services, which ignore minimums when billed', () => {
    expect(minimumChargeNotice({ ...selfService, min_quantity: 5 }, 1)).toBeNull();
  });
});

describe('priceSubtitle', () => {
  it('reads as one quiet line under a service name', () => {
    // The price sits where a shop card puts its address, so it has to be a
    // phrase rather than a figure in a column.
    expect(priceSubtitle({ ...comforter, price: 280 })).toBe('₱280/piece');
  });

  it('carries the shop rule the figure cannot', () => {
    expect(priceSubtitle(curtains)).toBe('₱60/kg · 3 kg minimum');
  });

  it('says only the number for a flat price', () => {
    // No unit and no minimum: a flat price is the whole price.
    expect(priceSubtitle({ ...selfService, price: 75 })).toBe('₱75');
  });

  it('keeps centavos a shop actually charges', () => {
    expect(priceSubtitle({ ...curtains, price: 60.5, min_quantity: 0 })).toBe('₱60.50/kg');
  });

  it('never trails a lone separator', () => {
    for (const service of [comforter, curtains, selfService]) {
      expect(priceSubtitle(service).trim()).not.toMatch(/·$/);
    }
  });
});

describe('unitCaption', () => {
  it('names what the figure is charged per', () => {
    expect(unitCaption('per_kg')).toBe('/kg');
    expect(unitCaption('per_item')).toBe('/piece');
  });

  it('says nothing for a flat price', () => {
    // Under a figure, the bare word "flat" is trade vocabulary — a customer
    // reads it as a missing unit, not as "this is the whole price". A flat
    // price needs no unit: the number is the number.
    expect(unitCaption('flat')).toBeNull();
  });

  it('matches the suffix used when the price is written as one line', () => {
    // `₱60.00` + `/kg` on two lines must say the same thing as `₱60.00/kg`.
    expect(unitCaption('per_kg')).toBe(unitSuffix('per_kg'));
    expect(unitCaption('per_item')).toBe(unitSuffix('per_item'));
  });
});

describe('minimumLabel', () => {
  it('states the shop rule on its own, without the price beside it', () => {
    // The storefront prints the figure in its own column. Repeating "₱60.00/kg"
    // underneath it put the same number on one row twice.
    expect(minimumLabel(curtains)).toBe('3 kg minimum');
  });

  it('says nothing when the service has no minimum', () => {
    expect(minimumLabel(comforter)).toBeNull();
  });

  it('says nothing for flat services, which ignore minimums when billed', () => {
    expect(minimumLabel({ ...selfService, min_quantity: 5 })).toBeNull();
  });

  it('agrees with the notice shown once a quantity is chosen', () => {
    // Two labels for one rule that could disagree is worse than one label.
    expect(minimumChargeNotice(curtains, 1)).toContain(minimumLabel(curtains)!);
  });
});
