import { railLineCount, selectedRailCategory } from '../service-rail';

const GROUPS = [
  { category: 'wash_fold', services: [{ id: 'a' }, { id: 'b' }] },
  { category: 'dry_cleaning', services: [{ id: 'c' }] },
];

describe('selectedRailCategory', () => {
  it('opens on the first category, so the grid is never empty on arrival', () => {
    // The rail hides everything it is not showing. Landing on nothing would
    // read as a shop with no prices.
    expect(selectedRailCategory(GROUPS, null)).toBe('wash_fold');
  });

  it('keeps the category the customer picked', () => {
    expect(selectedRailCategory(GROUPS, 'dry_cleaning')).toBe('dry_cleaning');
  });

  it('falls back when the remembered category is no longer on the list', () => {
    // A shop can delete every service in a category while a page is open, or
    // the customer can arrive with stale state. Neither should show a blank.
    expect(selectedRailCategory(GROUPS, 'ironing')).toBe('wash_fold');
  });

  it('has nothing to select in a shop with no services at all', () => {
    expect(selectedRailCategory([], null)).toBeNull();
  });
});

describe('railLineCount', () => {
  it('counts the lines this category has in the basket', () => {
    // The rail is a set of closed doors. Without this, a customer who added
    // two shirts under Dry Cleaning and then browsed away has no way to see
    // that anything is behind that door.
    expect(railLineCount({ a: 3, c: 1 }, GROUPS[0].services)).toBe(1);
    expect(railLineCount({ a: 3, b: 2, c: 1 }, GROUPS[0].services)).toBe(2);
  });

  it('counts lines, not units, because 8 kg is still one line', () => {
    expect(railLineCount({ a: 8 }, GROUPS[0].services)).toBe(1);
  });

  it('ignores a line that has been stepped down to nothing', () => {
    expect(railLineCount({ a: 0 }, GROUPS[0].services)).toBe(0);
  });

  it('is zero for a category nothing has been taken from', () => {
    expect(railLineCount({ a: 3 }, GROUPS[1].services)).toBe(0);
  });
});
