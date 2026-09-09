import { categoryPriceSummary, selectedCategoryLabel } from '../price-sections';

describe('categoryPriceSummary', () => {
  it('counts the prices in a closed section', () => {
    // Arrange
    const services = [{ price: 35 }, { price: 55 }, { price: 180 }];

    // Act
    const summary = categoryPriceSummary(services);

    // Assert
    expect(summary).toBe('3 prices · ₱35–₱180');
  });

  it('says "1 price" rather than "1 prices"', () => {
    expect(categoryPriceSummary([{ price: 20 }])).toBe('1 price · ₱20');
  });

  it('prints a single figure when every price in the section is the same', () => {
    // A shop charging ₱75 for both self-service machines should not be told
    // its range is "₱75–₱75".
    expect(categoryPriceSummary([{ price: 75 }, { price: 75 }])).toBe('2 prices · ₱75');
  });

  it('keeps the count when nothing in the section carries a usable price', () => {
    // A ₱0 service is a mistake the owner still has to find and fix, so the
    // section must not go quiet about how much is inside it.
    expect(categoryPriceSummary([{ price: 0 }, { price: 0 }])).toBe('2 prices');
  });

  it('ignores unpriced entries when reading the range', () => {
    expect(categoryPriceSummary([{ price: 0 }, { price: 60 }])).toBe('2 prices · ₱60');
  });

  it('is empty for a section with nothing in it', () => {
    expect(categoryPriceSummary([])).toBe('');
  });
});

describe('selectedCategoryLabel', () => {
  it('names the category currently chosen', () => {
    expect(selectedCategoryLabel('wash_fold')).toBe('Wash & Fold');
  });

  it('names every category the picker can offer', () => {
    // The closed picker is the only place the choice is shown, so a category
    // with no label would leave the control blank.
    expect(selectedCategoryLabel('other')).toBe('Other Services');
    expect(selectedCategoryLabel('special_items')).toBe('Bedding & Heavy Items');
  });
});
