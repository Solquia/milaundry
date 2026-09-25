import {
  categoryPriceSummary,
  savedNotice,
  unpricedNotice,
} from '../price-sections';

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

describe('unpricedNotice', () => {
  it('says nothing when every price is set', () => {
    expect(unpricedNotice([{ price: 35 }, { price: 60 }])).toBeNull();
  });

  it('names a single ₱0 price as something customers read as free', () => {
    // The closed section used to go quiet about a ₱0 row: the summary just
    // dropped the amount, which nobody notices.
    expect(unpricedNotice([{ price: 0 }, { price: 60 }])).toBe(
      '1 price is ₱0, so customers see it as free. Tap it to set a price.'
    );
  });

  it('counts several', () => {
    expect(unpricedNotice([{ price: 0 }, { price: 0 }])).toBe(
      '2 prices are ₱0, so customers see them as free. Tap each to set a price.'
    );
  });
});

describe('savedNotice', () => {
  it('says where a new service landed', () => {
    expect(savedNotice({ name: 'Comforter', category: 'special_items', verb: 'added' })).toBe(
      'Comforter added to Bedding & Heavy Items.'
    );
  });

  it('confirms a saved change', () => {
    expect(savedNotice({ name: 'Comforter', category: 'special_items', verb: 'saved' })).toBe(
      'Comforter saved.'
    );
  });

  it('confirms a removal', () => {
    expect(savedNotice({ name: 'Tide', category: 'other', verb: 'removed' })).toBe(
      'Tide removed from your price list.'
    );
  });
});
