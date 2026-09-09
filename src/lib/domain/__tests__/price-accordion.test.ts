import { categorySummaryLabel, nextOpenCategory } from '../price-accordion';

describe('nextOpenCategory', () => {
  it('opens the one you tapped', () => {
    expect(nextOpenCategory(null, 'special_items')).toBe('special_items');
  });

  it('closes whatever was open when you tap a different category', () => {
    // The whole point of the accordion: one section of prices on screen at a
    // time, so the list never grows past what a phone can hold.
    expect(nextOpenCategory('wash_fold', 'self_service')).toBe('self_service');
  });

  it('closes the open one when you tap it again', () => {
    // Without this the only way to collapse a section is to open another,
    // which makes the header feel broken the first time you try it.
    expect(nextOpenCategory('wash_fold', 'wash_fold')).toBeNull();
  });
});

describe('categorySummaryLabel', () => {
  it('tells you what is inside before you open it', () => {
    // A collapsed category that says nothing is a door with no sign. The count
    // and the cheapest way in are what let a customer skip it or open it.
    expect(categorySummaryLabel([{ price: 280 }, { price: 180 }, { price: 60 }])).toBe(
      '3 services · from ₱60'
    );
  });

  it('counts one service in the singular', () => {
    expect(categorySummaryLabel([{ price: 75 }])).toBe('1 service · from ₱75');
  });

  it('drops the price when nothing in it is actually priced', () => {
    // Never advertises "from ₱0": a free category and a category with no usable
    // price are different things, and neither is a sales pitch.
    expect(categorySummaryLabel([{ price: 0 }])).toBe('1 service');
  });

  it('says nothing about an empty category', () => {
    expect(categorySummaryLabel([])).toBe('');
  });

  it('quotes the cheapest, not the first', () => {
    expect(categorySummaryLabel([{ price: 500 }, { price: 35 }])).toContain('₱35');
  });
});
