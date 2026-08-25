import { CATEGORY_ICONS, categoryIcon } from '../shop-home';
import { CATEGORY_ORDER } from '../service-catalog';

describe('categoryIcon', () => {
  it('returns a distinct Ionicons glyph for every known category', () => {
    const icons = CATEGORY_ORDER.map((category) => categoryIcon(category));
    expect(new Set(icons).size).toBe(CATEGORY_ORDER.length);
    for (const icon of icons) {
      expect(icon).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it('maps wash_fold to a laundry-flavored icon', () => {
    expect(categoryIcon('wash_fold')).toBe('shirt-outline');
  });

  it('falls back to the "other" icon for unknown categories', () => {
    expect(categoryIcon('mystery_new_category')).toBe(CATEGORY_ICONS.other);
  });

  it('covers every category in CATEGORY_ICONS', () => {
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_ICONS[category]).toBeTruthy();
    }
  });
});
