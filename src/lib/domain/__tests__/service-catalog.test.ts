import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  STARTER_SERVICES,
  groupServicesByCategory,
  type ServiceCategory,
} from '../service-catalog';

describe('service categories', () => {
  it('defines a canonical category order with labels', () => {
    expect(CATEGORY_ORDER).toEqual([
      'wash_fold',
      'ironing',
      'dry_cleaning',
      'special_items',
      'self_service',
      'other',
    ]);
    CATEGORY_ORDER.forEach((category) =>
      expect(CATEGORY_LABELS[category]).toEqual(expect.any(String))
    );
  });

  it('groups services by category in canonical order, skipping empty ones', () => {
    const services = [
      { id: '1', name: 'Curtains', category: 'special_items' as ServiceCategory },
      { id: '2', name: 'Wash & Fold', category: 'wash_fold' as ServiceCategory },
      { id: '3', name: 'Bedding', category: 'special_items' as ServiceCategory },
    ];
    const groups = groupServicesByCategory(services);
    expect(groups.map((g) => g.category)).toEqual(['wash_fold', 'special_items']);
    expect(groups[1].services.map((s) => s.name)).toEqual(['Curtains', 'Bedding']);
  });

  it('treats an unknown category as other', () => {
    const groups = groupServicesByCategory([
      { id: '1', name: 'Legacy', category: 'bogus' as ServiceCategory },
    ]);
    expect(groups).toEqual([
      { category: 'other', services: [{ id: '1', name: 'Legacy', category: 'bogus' }] },
    ]);
  });
});

describe('starter price list', () => {
  it('covers the core laundromat selling styles', () => {
    const categories = new Set(STARTER_SERVICES.map((s) => s.category));
    expect(categories.has('wash_fold')).toBe(true);
    expect(categories.has('ironing')).toBe(true);
    expect(categories.has('dry_cleaning')).toBe(true);
    expect(categories.has('special_items')).toBe(true);
    expect(categories.has('self_service')).toBe(true);
  });

  it('includes a per-kilo wash service with a minimum weight', () => {
    const wash = STARTER_SERVICES.find(
      (s) => s.category === 'wash_fold' && s.unit === 'per_kg'
    );
    expect(wash).toBeDefined();
    expect(wash!.min_quantity).toBeGreaterThan(0);
  });

  it('prices heavy items per piece', () => {
    const perPieceSpecials = STARTER_SERVICES.filter(
      (s) => s.category === 'special_items' && s.unit === 'per_item'
    );
    expect(perPieceSpecials.length).toBeGreaterThan(0);
  });

  it('only uses valid units, categories, and positive prices', () => {
    STARTER_SERVICES.forEach((s) => {
      expect(['per_kg', 'per_item', 'flat']).toContain(s.unit);
      expect(CATEGORY_ORDER).toContain(s.category);
      expect(s.price).toBeGreaterThan(0);
      if (s.unit !== 'per_kg') expect(s.min_quantity).toBe(0);
    });
  });

  it('has unique service names', () => {
    const names = STARTER_SERVICES.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
