import {
  SHELF_GAP,
  SHELF_MIN_CARD,
  STARTER_ADDONS,
  addonKindNote,
  addonPayload,
  addonPriceLabel,
  addonsTotal,
  allowsMultiple,
  groupAddons,
  pickAddon,
  selectedAddons,
  setAddonQuantity,
  shelfColumns,
  validateAddonDraft,
  type AddonGroupRules,
  type ShopAddon,
} from '../shop-addons';

function addon(overrides: Partial<ShopAddon>): ShopAddon {
  return {
    id: 'a',
    shop_id: 'shop-1',
    kind: 'detergent',
    name: 'Ariel',
    note: '',
    price: 0,
    image_url: null,
    is_active: true,
    sort_order: 0,
    max_quantity: 1,
    ...overrides,
  };
}

const ariel = addon({ id: 'ariel', name: 'Ariel', price: 15, max_quantity: 3 });
const tide = addon({ id: 'tide', name: 'Tide', price: 12, sort_order: 1 });
const downy = addon({ id: 'downy', kind: 'fabcon', name: 'Downy', price: 10 });
const stain = addon({ id: 'stain', kind: 'extra', name: 'Stain treatment', price: 30 });
const bag = addon({ id: 'bag', kind: 'extra', name: 'Plastic bag', price: 5, sort_order: 1, max_quantity: 5 });
const retired = addon({ id: 'old', kind: 'extra', name: 'Old', price: 99, is_active: false });
const catalog = [ariel, tide, downy, stain, bag, retired];

const DEFAULT_RULES: AddonGroupRules = {};
const ONE_SOAP: AddonGroupRules = { detergent: false, fabcon: false };

describe('allowsMultiple', () => {
  it('lets the customer pick several of any kind until the shop says otherwise', () => {
    expect(allowsMultiple('extra', DEFAULT_RULES)).toBe(true);
    expect(allowsMultiple('detergent', DEFAULT_RULES)).toBe(true);
    expect(allowsMultiple('fabcon', DEFAULT_RULES)).toBe(true);
  });

  it('follows the shop when it says otherwise', () => {
    const rules: AddonGroupRules = { detergent: true, extra: false };
    expect(allowsMultiple('detergent', rules)).toBe(true);
    expect(allowsMultiple('extra', rules)).toBe(false);
  });
});

describe('addonKindNote', () => {
  it('tells the customer whether to pick one or several', () => {
    expect(addonKindNote('detergent', false)).toMatch(/one/i);
    expect(addonKindNote('detergent', true)).toMatch(/as many/i);
  });
});

describe('pickAddon', () => {
  it('puts one of an add-on on the load', () => {
    expect(pickAddon({}, ariel, catalog, DEFAULT_RULES)).toEqual({ ariel: 1 });
  });

  it('takes an add-on off when it is already on', () => {
    expect(pickAddon({ ariel: 2, downy: 1 }, ariel, catalog, DEFAULT_RULES)).toEqual({ downy: 1 });
  });

  it('swaps one soap for another where the shop allows one', () => {
    expect(pickAddon({ ariel: 2, downy: 1 }, tide, catalog, ONE_SOAP)).toEqual({
      downy: 1,
      tide: 1,
    });
  });

  it('keeps both soaps where the shop allows several, which is the default', () => {
    expect(pickAddon({ ariel: 1 }, tide, catalog, DEFAULT_RULES)).toEqual({ ariel: 1, tide: 1 });
  });

  it('keeps several extras side by side', () => {
    expect(pickAddon({ stain: 1 }, bag, catalog, DEFAULT_RULES)).toEqual({ stain: 1, bag: 1 });
  });

  it('does not change the picks it was given', () => {
    const picks = { ariel: 1 };
    pickAddon(picks, tide, catalog, DEFAULT_RULES);
    expect(picks).toEqual({ ariel: 1 });
  });
});

describe('setAddonQuantity', () => {
  it('sets how many of an add-on go on the load', () => {
    expect(setAddonQuantity({ bag: 1 }, bag, 3)).toEqual({ bag: 3 });
  });

  it('never goes past the most the shop allows', () => {
    expect(setAddonQuantity({ bag: 5 }, bag, 6)).toEqual({ bag: 5 });
  });

  it('takes the add-on off at zero', () => {
    expect(setAddonQuantity({ bag: 1, stain: 1 }, bag, 0)).toEqual({ stain: 1 });
  });

  it('rounds a fractional count down to whole items', () => {
    expect(setAddonQuantity({}, bag, 2.7)).toEqual({ bag: 2 });
  });
});

describe('selectedAddons and addonsTotal', () => {
  it('returns picked, active add-ons with their counts in catalog order', () => {
    expect(selectedAddons(catalog, { stain: 1, ariel: 2 })).toEqual([
      { addon: ariel, quantity: 2 },
      { addon: stain, quantity: 1 },
    ]);
  });

  it('ignores ids that are unknown or switched off', () => {
    expect(selectedAddons(catalog, { nope: 1, old: 1 })).toEqual([]);
  });

  it('holds a count to the most the shop now allows', () => {
    expect(selectedAddons(catalog, { tide: 4 })).toEqual([{ addon: tide, quantity: 1 }]);
  });

  it('adds up price times count', () => {
    expect(addonsTotal(catalog, { ariel: 2, downy: 1, bag: 3 })).toBe(55);
  });

  it('rounds to centavos', () => {
    const odd = [
      addon({ id: 'x', price: 0.1, max_quantity: 3 }),
      addon({ id: 'y', kind: 'extra', price: 0.2 }),
    ];
    expect(addonsTotal(odd, { x: 3, y: 1 })).toBe(0.5);
  });

  it('is zero with nothing picked', () => {
    expect(addonsTotal(catalog, {})).toBe(0);
  });
});

describe('addonPayload', () => {
  it('sends ids and counts only, never prices', () => {
    expect(addonPayload(selectedAddons(catalog, { bag: 2, ariel: 1 }))).toEqual([
      { id: 'ariel', quantity: 1 },
      { id: 'bag', quantity: 2 },
    ]);
  });
});

describe('groupAddons', () => {
  it('groups active add-ons by kind, soap first, sorted within a group', () => {
    const groups = groupAddons([bag, stain, tide, ariel, downy, retired]);
    expect(groups.map((g) => g.kind)).toEqual(['detergent', 'fabcon', 'extra']);
    expect(groups[0].addons.map((a) => a.id)).toEqual(['ariel', 'tide']);
    expect(groups[2].addons.map((a) => a.id)).toEqual(['stain', 'bag']);
  });

  it('leaves out a kind the shop offers nothing in', () => {
    expect(groupAddons([stain]).map((g) => g.kind)).toEqual(['extra']);
  });
});

describe('addonPriceLabel', () => {
  it('says Free for a zero price', () => {
    expect(addonPriceLabel(0)).toBe('Free');
  });

  it('shows a plus and the peso amount otherwise', () => {
    expect(addonPriceLabel(15)).toBe('+₱15.00');
  });
});

describe('validateAddonDraft', () => {
  it('accepts a named add-on with a price and a limit', () => {
    expect(validateAddonDraft({ name: '  Ariel ', price: '15', maxQuantity: '3' })).toEqual({
      ok: true,
      value: { name: 'Ariel', price: 15, max_quantity: 3 },
    });
  });

  it('treats an empty price as free and an empty limit as one', () => {
    expect(validateAddonDraft({ name: 'Downy', price: '', maxQuantity: '' })).toEqual({
      ok: true,
      value: { name: 'Downy', price: 0, max_quantity: 1 },
    });
  });

  it('needs a name', () => {
    const result = validateAddonDraft({ name: ' ', price: '5', maxQuantity: '1' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.name).toBeTruthy();
  });

  it('refuses a negative, silly or non-numeric price', () => {
    for (const price of ['-1', 'abc', '100000']) {
      expect(validateAddonDraft({ name: 'Ariel', price, maxQuantity: '1' }).ok).toBe(false);
    }
  });

  it('refuses a limit that is not a whole number from 1 to 20', () => {
    for (const maxQuantity of ['0', '21', '1.5', 'many']) {
      const result = validateAddonDraft({ name: 'Ariel', price: '1', maxQuantity });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.maxQuantity).toBeTruthy();
    }
  });

  it('refuses a name longer than 40 characters', () => {
    expect(validateAddonDraft({ name: 'x'.repeat(41), price: '1', maxQuantity: '1' }).ok).toBe(false);
  });
});

describe('STARTER_ADDONS', () => {
  it('stocks soaps and fabcons at a set price the owner can change', () => {
    expect(STARTER_ADDONS.every((row) => row.price > 0)).toBe(true);
    expect(STARTER_ADDONS.find((row) => row.name === 'Ariel')?.price).toBe(15);
    expect(STARTER_ADDONS.find((row) => row.name === 'Downy')?.price).toBe(10);
    expect(new Set(STARTER_ADDONS.map((row) => row.kind))).toEqual(new Set(['detergent', 'fabcon']));
  });
});

describe('shelfColumns', () => {
  it('fits three products across a phone', () => {
    expect(shelfColumns(328)).toBe(3);
  });

  it('drops to two on a very narrow screen rather than shrinking the photos', () => {
    expect(shelfColumns(280)).toBe(2);
  });

  it('opens up to four on a tablet or a wide browser, and no further', () => {
    expect(shelfColumns(560)).toBe(4);
    expect(shelfColumns(2000)).toBe(4);
  });

  it('assumes a phone before the row has been measured', () => {
    expect(shelfColumns(0)).toBe(3);
  });

  it('keeps every card at least the minimum width', () => {
    for (const width of [240, 300, 330, 400, 480, 600]) {
      const columns = shelfColumns(width);
      expect((width - SHELF_GAP * (columns - 1)) / columns).toBeGreaterThanOrEqual(
        Math.min(SHELF_MIN_CARD, width)
      );
    }
  });
});
