import {
  EMPTY_SERVICE_DRAFT,
  draftFromService,
  loadSizeExample,
  looksLikeAddon,
  unitHelp,
  validateServiceDraft,
  type ServiceDraft,
} from '../service-draft';

const complete: ServiceDraft = {
  name: 'Wash, Dry & Fold',
  category: 'wash_fold',
  unit: 'per_kg',
  price: '35',
  minQuantity: '5',
  maxQuantity: '',
  description: 'Regular clothes',
};

describe('validateServiceDraft', () => {
  it('accepts a complete draft and returns the row to save', () => {
    // Act
    const result = validateServiceDraft(complete);

    // Assert
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Wash, Dry & Fold',
        category: 'wash_fold',
        unit: 'per_kg',
        price: 35,
        min_quantity: 5,
        max_quantity: 0,
        description: 'Regular clothes',
        weight_prices: [],
      },
    });
  });

  it('starts empty, with no category or unit chosen for the owner', () => {
    // A default of Wash & Fold, per kg filed "Comforter" there unnoticed.
    expect(EMPTY_SERVICE_DRAFT.category).toBeNull();
    expect(EMPTY_SERVICE_DRAFT.unit).toBeNull();
  });

  it('reports every missing answer at once, each against its own field', () => {
    const result = validateServiceDraft(EMPTY_SERVICE_DRAFT);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.name).toBeTruthy();
    expect(result.errors.category).toBeTruthy();
    expect(result.errors.unit).toBeTruthy();
    expect(result.errors.price).toBeTruthy();
  });

  it('refuses a ₱0 price, which customers would read as free', () => {
    const result = validateServiceDraft({ ...complete, price: '0' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.price).toMatch(/free/i);
  });

  it('refuses a price that is not a number', () => {
    const result = validateServiceDraft({ ...complete, price: 'abc' });
    expect(result.ok).toBe(false);
  });

  it('refuses a minimum that is not a number rather than saving 0', () => {
    const result = validateServiceDraft({ ...complete, minQuantity: 'abc' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.minQuantity).toBeTruthy();
  });

  it('treats a blank minimum as no minimum', () => {
    const result = validateServiceDraft({ ...complete, minQuantity: '  ' });
    expect(result.ok && result.value.min_quantity).toBe(0);
  });

  it('drops the minimum for units that are not billed by weight', () => {
    const result = validateServiceDraft({ ...complete, unit: 'per_item', minQuantity: '5' });
    expect(result.ok && result.value.min_quantity).toBe(0);
  });

  it('rounds the price to centavos and trims text', () => {
    const result = validateServiceDraft({
      ...complete,
      name: '  Comforter  ',
      price: '120.555',
      description: '  ',
    });

    expect(result.ok && result.value).toMatchObject({
      name: 'Comforter',
      price: 120.56,
      description: '',
    });
  });
});

describe('draftFromService', () => {
  it('opens every saved field for editing', () => {
    const draft = draftFromService({
      name: 'Comforter',
      category: 'special_items',
      unit: 'per_item',
      price: 120,
      min_quantity: 0,
      description: 'Queen size',
    });

    expect(draft).toEqual({
      name: 'Comforter',
      category: 'special_items',
      unit: 'per_item',
      price: '120',
      minQuantity: '',
      maxQuantity: '',
      description: 'Queen size',
    });
  });

  it('leaves the price blank when the saved one is ₱0, so it reads as unfinished', () => {
    const draft = draftFromService({
      name: 'Tide',
      category: 'other',
      unit: 'per_item',
      price: 0,
      min_quantity: 0,
      description: null,
    });

    expect(draft.price).toBe('');
    expect(draft.description).toBe('');
  });

  it('falls back to Other for a category the app does not know', () => {
    const draft = draftFromService({
      name: 'Mystery',
      category: 'shoes',
      unit: 'flat',
      price: 50,
      min_quantity: 0,
      description: '',
    });

    expect(draft.category).toBe('other');
  });
});

describe('looksLikeAddon', () => {
  it.each(['Tide', 'Ariel powder', 'Downy fabcon', 'Zonrox', 'Detergent', 'Fabric softener'])(
    'recognises %s as something on the shelf, not a service',
    (name) => {
      expect(looksLikeAddon(name)).toBe(true);
    }
  );

  it.each(['Wash, Dry & Fold', 'Comforter', 'Barong dry clean', '', 'Tidewater curtains'])(
    'leaves %s alone',
    (name) => {
      expect(looksLikeAddon(name)).toBe(false);
    }
  );
});

describe('unitHelp', () => {
  it("explains what each unit bills, in the owner's words", () => {
    expect(unitHelp('per_kg')).toMatch(/weigh/i);
    expect(unitHelp('per_item')).toMatch(/each/i);
    expect(unitHelp('flat')).toMatch(/one price/i);
  });
});

describe('load weight limit', () => {
  const perLoad: ServiceDraft = {
    name: 'Wash-Dry-Fold',
    category: 'wash_fold',
    unit: 'flat',
    price: '150',
    minQuantity: '',
    maxQuantity: '6',
    description: 'Regular clothes',
  };

  it('saves the most a load can weigh on a per-load price', () => {
    const result = validateServiceDraft(perLoad);
    expect(result.ok && result.value.max_quantity).toBe(6);
  });

  it('treats a blank limit as no limit', () => {
    const result = validateServiceDraft({ ...perLoad, maxQuantity: '  ' });
    expect(result.ok && result.value.max_quantity).toBe(0);
  });

  it('rejects a limit that is not a positive weight', () => {
    for (const bad of ['0', '-2', 'six']) {
      const result = validateServiceDraft({ ...perLoad, maxQuantity: bad });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.maxQuantity).toMatch(/kg/);
    }
  });

  it('rejects a limit lighter than the smallest load it charges for', () => {
    const result = validateServiceDraft({ ...complete, minQuantity: '8', maxQuantity: '6' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.maxQuantity).toMatch(/smallest/);
  });

  it('ignores a limit on a per-piece price, where weight is not charged', () => {
    const result = validateServiceDraft({ ...perLoad, unit: 'per_item', maxQuantity: '6' });
    expect(result.ok && result.value.max_quantity).toBe(0);
  });

  it('opens a saved limit for editing', () => {
    const draft = draftFromService({
      name: 'Comforters',
      category: 'special_items',
      unit: 'flat',
      price: 150,
      min_quantity: 0,
      max_quantity: 4,
      description: '',
    });
    expect(draft.maxQuantity).toBe('4');
  });
});

describe('per-load price', () => {
  const perLoad: ServiceDraft = {
    name: 'Wash-Dry-Fold',
    category: 'wash_fold',
    unit: 'per_load',
    price: '150',
    minQuantity: '',
    maxQuantity: '4',
    description: '',
  };

  it('saves as a flat price per load with the load size the owner chose', () => {
    // Act
    const result = validateServiceDraft(perLoad);

    // Assert
    expect(result.ok && result.value).toMatchObject({ unit: 'flat', price: 150, max_quantity: 4 });
  });

  it('takes any load size, not only round ones', () => {
    const result = validateServiceDraft({ ...perLoad, maxQuantity: '7.5' });
    expect(result.ok && result.value.max_quantity).toBe(7.5);
  });

  it('needs the load size, since the price means nothing without it', () => {
    const result = validateServiceDraft({ ...perLoad, maxQuantity: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.maxQuantity).toMatch(/kg/);
  });

  it('never saves a minimum, which a per-load price does not bill', () => {
    const result = validateServiceDraft({ ...perLoad, minQuantity: '5' });
    expect(result.ok && result.value.min_quantity).toBe(0);
  });

  it('refuses Bedding, where a load size would read as a size per piece', () => {
    const result = validateServiceDraft({ ...perLoad, category: 'special_items' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.unit).toMatch(/piece/i);
  });

  it('opens a saved per-load price as Per load', () => {
    const draft = draftFromService({
      name: 'Wash-Dry-Fold',
      category: 'wash_fold',
      unit: 'flat',
      price: 150,
      min_quantity: 0,
      max_quantity: 4,
      description: '',
    });
    expect(draft.unit).toBe('per_load');
    expect(draft.maxQuantity).toBe('4');
  });

  it('keeps a flat price with no load size as Flat price', () => {
    const draft = draftFromService({
      name: 'Self-service wash',
      category: 'wash_fold',
      unit: 'flat',
      price: 60,
      min_quantity: 0,
      max_quantity: 0,
      description: '',
    });
    expect(draft.unit).toBe('flat');
  });

  it('explains that heavier laundry is billed as more loads', () => {
    expect(unitHelp('per_load')).toMatch(/more loads/i);
  });
});

describe('loadSizeExample', () => {
  it('works one heavier load through with the owner’s own figures', () => {
    expect(loadSizeExample({ ...EMPTY_SERVICE_DRAFT, maxQuantity: '4', price: '150' })).toBe(
      '9 kg is 3 loads = ₱450.'
    );
  });

  it('leaves the price out until there is one', () => {
    expect(loadSizeExample({ ...EMPTY_SERVICE_DRAFT, maxQuantity: '7.5' })).toBe(
      '16 kg is 3 loads.'
    );
  });

  it('asks for the size while there is none', () => {
    expect(loadSizeExample({ ...EMPTY_SERVICE_DRAFT, maxQuantity: 'x' })).toMatch(/one load holds/);
  });
});

describe('pricing by a weight table', () => {
  const board = [
    { up_to_kg: 8, price: 185 },
    { up_to_kg: 8.5, price: 200 },
  ];
  const tableDraft: ServiceDraft = {
    ...complete,
    unit: 'per_load',
    price: '',
    minQuantity: '',
    maxQuantity: '',
    priceBy: 'table',
  };

  it('needs no single price or kg per load, and saves the table', () => {
    const result = validateServiceDraft(tableDraft, board);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ unit: 'flat', price: 185, max_quantity: 0, min_quantity: 0 });
    expect(result.value.weight_prices).toEqual(board);
  });

  it('keeps kg per load as a label and takes the price from the table', () => {
    const result = validateServiceDraft({ ...tableDraft, maxQuantity: '8', price: '999', minQuantity: '5' }, board);
    expect(result.ok && result.value).toMatchObject({ price: 185, max_quantity: 8, min_quantity: 0 });
  });

  it('asks for a row when the table is empty', () => {
    const result = validateServiceDraft(tableDraft, []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.weightPrices).toMatch(/row/);
  });

  it('saves no table when the owner charges one price', () => {
    const result = validateServiceDraft({ ...tableDraft, priceBy: 'one', price: '185', maxQuantity: '8' }, board);
    expect(result.ok && result.value.weight_prices).toEqual([]);
  });

  it('opens a service with a table in table mode', () => {
    const draft = draftFromService({
      name: 'Package 1',
      category: 'wash_fold',
      unit: 'flat',
      price: 185,
      min_quantity: 0,
      max_quantity: 8,
      description: '',
      weight_prices: board,
    });
    expect(draft.priceBy).toBe('table');
    expect(draft.unit).toBe('per_load');
  });
});
