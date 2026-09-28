import { extraArt, extraLabel, extraLimit, extraTilePrice, stepExtra } from '../heavy-items';
import type { Service } from '../pricing';

const beddings: Service = { id: 'bed', name: 'BIG BEDDINGS', unit: 'per_item', price: 123 };
const curtains: Service = { id: 'cur', name: 'Curtains', unit: 'per_kg', price: 56, min_quantity: 3 };
const steam: Service = { id: 'st', name: 'Steam', unit: 'flat', price: 90 };

describe('stepExtra', () => {
  it('adds and removes one at a time', () => {
    expect(stepExtra('per_item', 0, 1)).toBe(1);
    expect(stepExtra('per_item', 2, -1)).toBe(1);
  });

  it('never goes below zero', () => {
    expect(stepExtra('per_item', 0, -1)).toBe(0);
  });

  it('stops at the limit for the unit', () => {
    expect(stepExtra('per_item', extraLimit('per_item'), 1)).toBe(extraLimit('per_item'));
    expect(stepExtra('per_kg', extraLimit('per_kg'), 1)).toBe(extraLimit('per_kg'));
  });

  it('counts a flat extra like pieces: three comforters are three flat charges', () => {
    expect(extraLimit('flat')).toBe(extraLimit('per_item'));
    expect(stepExtra('flat', 1, 1)).toBe(2);
  });

  it('steps a half-kilo guess back onto whole kilos', () => {
    expect(stepExtra('per_kg', 2.5, 1)).toBe(3);
    expect(stepExtra('per_kg', 2.5, -1)).toBe(2);
  });
});

describe('extraTilePrice', () => {
  it('shows the short rate until something is added', () => {
    expect(extraTilePrice(beddings, 0)).toBe('₱123/pc');
    expect(extraTilePrice(curtains, 0)).toBe('₱56/kg');
    expect(extraTilePrice(steam, 0)).toBe('₱90');
  });

  it('shows what the added amount is billed, minimum included', () => {
    expect(extraTilePrice(beddings, 2)).toBe('₱246');
    expect(extraTilePrice(curtains, 1)).toBe('₱168');
    expect(extraTilePrice(steam, 3)).toBe('₱270');
  });
});

describe('extraLabel', () => {
  it('splits a long name into the thing and its variant', () => {
    expect(extraLabel('Comforter — Extra Thick / Extra Large')).toEqual({
      title: 'Comforter',
      variant: 'Extra thick / XL',
    });
    expect(extraLabel('Comforter (King size)')).toEqual({ title: 'Comforter', variant: 'King size' });
    expect(extraLabel('Curtains - heavy')).toEqual({ title: 'Curtains', variant: 'Heavy' });
  });

  it('leaves a plain name alone, and calms a shouted one', () => {
    expect(extraLabel('Bedsheets & Blankets')).toEqual({ title: 'Bedsheets & Blankets', variant: null });
    expect(extraLabel('BIG BEDDINGS')).toEqual({ title: 'Big Beddings', variant: null });
  });
});

describe('extraArt', () => {
  it('draws each kind of heavy item as itself', () => {
    expect(extraArt('Bedsheets & Blankets')).toBe('sheets');
    expect(extraArt('Bed linen')).toBe('sheets');
    expect(extraArt('Fleece blanket')).toBe('blanket');
    expect(extraArt('Comforters')).toBe('comforter');
    expect(extraArt('Duvet')).toBe('comforter');
    expect(extraArt('Comforter — Extra Thick / Extra Large')).toBe('bulky');
    expect(extraArt('King size quilt')).toBe('bulky');
    expect(extraArt('Pillows')).toBe('pillow');
    expect(extraArt('Rug / carpet')).toBe('rug');
    expect(extraArt('Stuffed toys')).toBe('toy');
    expect(extraArt('Curtains')).toBe('curtain');
    expect(extraArt('Sneakers')).toBe('shoe');
    expect(extraArt('Large Item')).toBe('sack');
  });
});
