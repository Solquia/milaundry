import {
  EMPTY_SERVICE_DRAFT,
  draftFromService,
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
        description: 'Regular clothes',
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
