import {
  filterShelf,
  groupShelf,
  shelfColumns,
  shelfEmptyNote,
  shelfMatches,
  shelfPill,
} from '../service-shelf';
import type { ServiceCategory } from '../service-catalog';

function service(over: Partial<Parameters<typeof shelfPill>[0]> = {}) {
  return {
    id: 's1',
    name: 'Wash & Fold',
    unit: 'per_kg' as const,
    price: 60,
    min_quantity: 0,
    ...over,
  };
}

function shelved(over: Record<string, unknown> = {}) {
  return {
    name: 'Wash & Fold',
    unit: 'per_kg' as const,
    price: 60,
    min_quantity: 0,
    category: 'wash_fold' as ServiceCategory,
    description: '',
    ...over,
  };
}

describe('shelfPill', () => {
  test('states the billable minimum when the shop set one', () => {
    const pill = shelfPill(service({ min_quantity: 3 }));

    expect(pill).toEqual({ kind: 'rule', text: '3 kg min' });
  });

  test('states how the shop counts it when there is no minimum', () => {
    expect(shelfPill(service({ unit: 'per_kg' })).text).toBe('By weight');
    expect(shelfPill(service({ unit: 'per_item' })).text).toBe('Per piece');
    expect(shelfPill(service({ unit: 'flat' })).text).toBe('Flat rate');
  });

  test('ignores a minimum on a flat price, which is billed once regardless', () => {
    const pill = shelfPill(service({ unit: 'flat', min_quantity: 5 }));

    expect(pill).toEqual({ kind: 'unit', text: 'Flat rate' });
  });

  test('never promises a turnaround, because no service carries one', () => {
    const units = ['per_kg', 'per_item', 'flat'] as const;

    for (const unit of units) {
      for (const min of [0, 2]) {
        const { text } = shelfPill(service({ unit, min_quantity: min }));
        expect(text).not.toMatch(/hr|hour|day|eta|ready/i);
      }
    }
  });
});

describe('shelfMatches', () => {
  test('finds a service by part of its name, whatever the case', () => {
    expect(shelfMatches(shelved(), 'wash')).toBe(true);
    expect(shelfMatches(shelved(), 'FOLD')).toBe(true);
  });

  test('finds a service by its category, which is on the card', () => {
    expect(shelfMatches(shelved({ name: 'Barong', category: 'dry_cleaning' }), 'dry')).toBe(true);
  });

  test('finds a service by the shop own words', () => {
    expect(shelfMatches(shelved({ description: 'Same-day pickup for curtains' }), 'curtains')).toBe(
      true
    );
  });

  test('finds a per-kg service by how it is counted', () => {
    expect(shelfMatches(shelved({ unit: 'per_kg' }), 'kg')).toBe(true);
    expect(shelfMatches(shelved({ unit: 'per_item' }), 'kg')).toBe(false);
  });

  test('every word has to land, so two unrelated words match nothing', () => {
    expect(shelfMatches(shelved(), 'wash fold')).toBe(true);
    expect(shelfMatches(shelved(), 'wash comforter')).toBe(false);
  });

  test('punctuation in the name or the query does not block a match', () => {
    expect(shelfMatches(shelved({ name: 'Wash & Fold' }), 'wash fold')).toBe(true);
    expect(shelfMatches(shelved({ name: 'Wash and Fold' }), 'wash,')).toBe(true);
  });

  test('an empty or blank query matches everything', () => {
    expect(shelfMatches(shelved(), '')).toBe(true);
    expect(shelfMatches(shelved(), '   ')).toBe(true);
  });
});

describe('filterShelf', () => {
  const entries = [
    { service: shelved({ name: 'Wash & Fold' }), label: 'Wash & Fold' },
    { service: shelved({ name: 'Barong', category: 'dry_cleaning' }), label: 'Dry Cleaning' },
    { service: shelved({ name: 'Comforter', category: 'special_items' }), label: 'Special Items' },
  ];

  test('keeps the order the grid already had', () => {
    const kept = filterShelf(entries, '');

    expect(kept.map((entry) => entry.service.name)).toEqual(['Wash & Fold', 'Barong', 'Comforter']);
  });

  test('narrows to what was typed', () => {
    const kept = filterShelf(entries, 'comf');

    expect(kept).toHaveLength(1);
    expect(kept[0].service.name).toBe('Comforter');
  });

  test('returns a copy, so the caller cannot mutate the shelf', () => {
    const kept = filterShelf(entries, '');

    expect(kept).not.toBe(entries);
  });

  test('a query nothing answers returns nothing rather than everything', () => {
    expect(filterShelf(entries, 'sneakers')).toHaveLength(0);
  });
});

describe('shelfEmptyNote', () => {
  test('a shop with no services is told so, without blaming a search', () => {
    expect(shelfEmptyNote('')).toBe("This shop hasn't listed services yet.");
  });

  test('a search that found nothing names the words and the way back', () => {
    const note = shelfEmptyNote('sneakers');

    expect(note).toContain('sneakers');
    expect(note).toContain('Clear the search');
  });
});

describe('groupShelf', () => {
  const entry = (id: string, category: ServiceCategory) => ({
    service: { ...shelved({ category }), id },
    label: category,
  });

  it('gathers neighbouring services of one category under one heading', () => {
    const groups = groupShelf([
      entry('a', 'wash_fold'),
      entry('b', 'special_items'),
      entry('c', 'special_items'),
    ]);
    expect(groups.map((group) => group.category)).toEqual(['wash_fold', 'special_items']);
    expect(groups[1].title).toBe('Bedding & Heavy Items');
    expect(groups[1].entries.map((item) => item.service.id)).toEqual(['b', 'c']);
  });

  it('keeps the order it was given', () => {
    const groups = groupShelf([entry('a', 'ironing'), entry('b', 'wash_fold')]);
    expect(groups.map((group) => group.category)).toEqual(['ironing', 'wash_fold']);
  });

  it('returns nothing for an empty shelf', () => {
    expect(groupShelf([])).toEqual([]);
  });
});

describe('shelfColumns', () => {
  it('stacks the groups on a phone', () => {
    expect(shelfColumns(1)).toBe(1);
    expect(shelfColumns(2)).toBe(1);
  });

  it('sets the groups two abreast once the window is wide', () => {
    expect(shelfColumns(3)).toBe(2);
    expect(shelfColumns(4)).toBe(2);
  });
});
