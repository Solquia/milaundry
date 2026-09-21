import { CATEGORY_LABELS, CATEGORY_ORDER, CATEGORY_SHORT, STARTER_SERVICES, groupServicesByCategory, labelledServices, splitServicesByStatus, type ServiceCategory } from '../service-catalog';
import { gridRows } from '../web-layout';

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

describe('active vs removed services', () => {
  const wash = { id: '1', name: 'Wash & Fold', is_active: true };
  const mistake = { id: '2', name: 'WASH AND FOLD', is_active: false };
  const iron = { id: '3', name: 'Ironing', is_active: true };

  it('separates services still on the price list from removed ones', () => {
    const { active, removed } = splitServicesByStatus([wash, mistake, iron]);
    expect(active).toEqual([wash, iron]);
    expect(removed).toEqual([mistake]);
  });

  it('keeps the original order within each group', () => {
    const { active } = splitServicesByStatus([iron, wash]);
    expect(active.map((service) => service.id)).toEqual(['3', '1']);
  });

  it('returns empty groups for an empty list', () => {
    expect(splitServicesByStatus([])).toEqual({ active: [], removed: [] });
  });

  it('reports nothing removed when every service is active', () => {
    expect(splitServicesByStatus([wash, iron]).removed).toEqual([]);
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

describe('CATEGORY_SHORT', () => {
  it('names every category', () => {
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_SHORT[category]).toBeTruthy();
    }
  });

  it('is short enough to sit in a chip on a card', () => {
    // The full labels run to "Bedding & Heavy Items", which wraps twice in the
    // corner of a card two-to-a-row on a phone.
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_SHORT[category].length).toBeLessThanOrEqual(12);
    }
  });

  it('never loses which category it names', () => {
    const shorts = CATEGORY_ORDER.map((c) => CATEGORY_SHORT[c]);
    expect(new Set(shorts).size).toBe(CATEGORY_ORDER.length);
  });
});

describe('labelledServices', () => {
  const services = [
    { id: 'w', name: 'Wash And Fold', category: 'wash_fold' as ServiceCategory },
    { id: 'i', name: 'Ironing', category: 'ironing' as ServiceCategory },
    { id: 'd', name: 'Dry Clean', category: 'dry_cleaning' as ServiceCategory },
  ];

  it('flattens the groups into one list in category order', () => {
    const ordered = labelledServices(groupServicesByCategory(services));

    expect(ordered.map((entry) => entry.service.id)).toEqual(['w', 'i', 'd']);
  });

  it('gives every service its own category to wear', () => {
    const ordered = labelledServices(groupServicesByCategory(services));

    expect(ordered.map((entry) => entry.label)).toEqual(['Wash & Fold', 'Ironing', 'Dry Clean']);
  });

  it('closes up a shop with one service per category into one block', () => {
    // The point of flattening: three one-service categories have to become
    // three consecutive entries the grid can pair up, not three lonely rows
    // each holding a half-width card and a blank.
    const ordered = labelledServices(groupServicesByCategory(services));

    expect(ordered).toHaveLength(3);
  });

  it('returns nothing for a shop that has posted no services', () => {
    expect(labelledServices(groupServicesByCategory([]))).toEqual([]);
  });

  it('puts wash and fold beside ironing on a two-up grid, not on the next row', () => {
    const rows = gridRows(labelledServices(groupServicesByCategory(services)), 2);

    expect(rows[0]?.map((entry) => entry?.service.id)).toEqual(['w', 'i']);
    expect(rows[1]?.map((entry) => entry?.service.id)).toEqual(['d', undefined]);
  });
});
