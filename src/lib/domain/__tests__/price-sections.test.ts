import {
  savedNotice,
  unpricedNotice,
} from '../price-sections';

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
