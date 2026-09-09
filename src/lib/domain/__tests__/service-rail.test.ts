import {
  categoryPresentation,
  railLineCount,
  resolvePick,
  selectedRailCategory,
} from '../service-rail';

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

describe('categoryPresentation', () => {
  it('measures when the category holds a single service', () => {
    // With nothing to choose between, a picture is decoration. The question
    // is "how much?", so the screen should be the app's scale or piece picker.
    expect(categoryPresentation(1)).toBe('measure');
  });

  it('shows pictures once there is a choice to make', () => {
    // Two or more services and the picture is the whole point: it is what the
    // customer picks between before they say how much.
    expect(categoryPresentation(2)).toBe('choose');
    expect(categoryPresentation(6)).toBe('choose');
  });

  it('has nothing to measure in an empty category', () => {
    expect(categoryPresentation(0)).toBe('choose');
  });
});

describe('resolvePick', () => {
  const ONE = { category: 'wash_fold', services: [{ id: 'a' }] };
  const MANY = { category: 'special_items', services: [{ id: 'b' }, { id: 'c' }] };

  it('picks the only service in a category, so opening it is one tap not two', () => {
    // A list of one is not a choice. Making the customer tap it before the
    // scale appears is a step that exists only because the code has a slot
    // for it.
    expect(resolvePick(ONE, null)).toBe('a');
  });

  it('picks nothing when there is a real choice to make', () => {
    expect(resolvePick(MANY, null)).toBeNull();
  });

  it('keeps what the customer picked', () => {
    expect(resolvePick(MANY, 'c')).toBe('c');
  });

  it('drops a pick that belongs to a different category', () => {
    // Opening Bedding while a Wash & Fold service is remembered must not
    // leave the controls set to something the list no longer shows.
    expect(resolvePick(MANY, 'a')).toBeNull();
  });

  it('still falls to the only service when the stale pick is dropped', () => {
    expect(resolvePick(ONE, 'zzz')).toBe('a');
  });

  it('picks nothing at all when there is no category open', () => {
    expect(resolvePick(undefined, 'a')).toBeNull();
  });
});
