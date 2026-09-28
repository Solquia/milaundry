import { boardFilter, rowMinimum, sharedMinimum, unitWord } from '../price-board';
import type { PricingUnit } from '../pricing';
import type { ServiceCategory } from '../service-catalog';

function svc(
  name: string,
  unit: PricingUnit,
  min_quantity = 0,
  category: ServiceCategory = 'wash_fold',
  max_quantity = 0
) {
  return { id: name, name, unit, price: 70, min_quantity, max_quantity, category };
}

describe('sharedMinimum', () => {
  it('lifts a minimum every weighed row repeats into the heading', () => {
    const rows = [svc('Dry & Fold', 'per_kg', 1), svc('Wash Only', 'per_kg', 1)];
    expect(sharedMinimum(rows)).toBe('1 kg minimum');
  });

  it('ignores flat rows, which never carry a minimum', () => {
    const rows = [svc('Sheets', 'per_kg', 1), svc('Blanket', 'per_kg', 1), svc('Comforter', 'flat')];
    expect(sharedMinimum(rows)).toBe('1 kg minimum');
  });

  it('says nothing when the minimums differ', () => {
    expect(sharedMinimum([svc('A', 'per_kg', 1), svc('B', 'per_kg', 3)])).toBeNull();
  });

  it('says nothing when one row has no minimum', () => {
    expect(sharedMinimum([svc('A', 'per_kg', 1), svc('B', 'per_kg', 0)])).toBeNull();
  });

  it('needs two rows to be worth lifting', () => {
    expect(sharedMinimum([svc('A', 'per_kg', 1), svc('B', 'flat')])).toBeNull();
  });

  it('does not treat 1 kg and 1 piece as the same minimum', () => {
    expect(sharedMinimum([svc('A', 'per_kg', 1), svc('B', 'per_item', 1)])).toBeNull();
  });
});

describe('rowMinimum', () => {
  it('drops a minimum the heading already says', () => {
    expect(rowMinimum(svc('A', 'per_kg', 1), '1 kg minimum')).toBeNull();
  });

  it('keeps a minimum that differs from the heading', () => {
    expect(rowMinimum(svc('A', 'per_kg', 3), null)).toBe('3 kg minimum');
  });
});

describe('unitWord', () => {
  it('names each way a shop charges', () => {
    expect(unitWord(svc('A', 'per_kg'))).toBe('per kg');
    expect(unitWord(svc('A', 'per_item'))).toBe('per piece');
    expect(unitWord(svc('A', 'flat'))).toBe('flat rate');
  });

  it('calls a flat price with a load limit a load', () => {
    expect(unitWord(svc('Self wash', 'flat', 0, 'self_service', 8))).toBe('per load');
  });
});

describe('boardFilter', () => {
  const rows = [
    svc('Dry & Fold', 'per_kg', 1, 'wash_fold'),
    svc('Comforters', 'flat', 0, 'special_items'),
    svc('Comforter — Extra Thick', 'flat', 0, 'special_items'),
    svc('Express Service', 'flat', 0, 'other'),
  ];

  it('keeps every category in order when nothing is chosen', () => {
    const groups = boardFilter(rows, 'all', '');
    expect(groups.map((g) => g.category)).toEqual(['wash_fold', 'special_items', 'other']);
  });

  it('narrows to one category', () => {
    const groups = boardFilter(rows, 'special_items', '');
    expect(groups).toHaveLength(1);
    expect(groups[0].services).toHaveLength(2);
  });

  it('matches a name case-insensitively, ignoring stray spaces', () => {
    const groups = boardFilter(rows, 'all', '  COMFORTER ');
    expect(groups.flatMap((g) => g.services.map((s) => s.name))).toEqual([
      'Comforters',
      'Comforter — Extra Thick',
    ]);
  });

  it('returns no groups when nothing matches', () => {
    expect(boardFilter(rows, 'all', 'shoes')).toEqual([]);
  });
});
