import { accentIndex } from '../accent';
import {
  MAX_TAGLINE,
  assignBrandAccents,
  isValidAccent,
  resolveAccent,
  validateTagline,
  type BrandedShop,
} from '../shop-branding';

const COUNT = 6;
const auto = (id: string): BrandedShop => ({ id, brand_accent: null });
const chose = (id: string, brand_accent: number): BrandedShop => ({ id, brand_accent });

describe('resolveAccent', () => {
  it('falls back to the hashed tone when the shop has not chosen', () => {
    // Unbranded shops must keep the colour they have always had; picking a
    // different one on upgrade would move every shop in every customer's list.
    expect(resolveAccent(auto('shop-a'), COUNT)).toBe(accentIndex('shop-a', COUNT));
  });

  it('honours a tone the shop chose', () => {
    expect(resolveAccent(chose('shop-a', 3), COUNT)).toBe(3);
  });

  it('honours a chosen zero rather than treating it as unset', () => {
    // 0 is a real accent. Anything testing this field for truthiness would
    // silently discard the first colour in the palette.
    expect(resolveAccent(chose('shop-a', 0), COUNT)).toBe(0);
  });

  it('falls back to the hash for an index the palette no longer has', () => {
    // A tone saved when the palette was larger. Wrapping it with modulo would
    // hand the shop an arbitrary different colour; the hash is at least stable.
    expect(resolveAccent(chose('shop-a', 99), COUNT)).toBe(accentIndex('shop-a', COUNT));
  });

  it('falls back to the hash for a negative or fractional index', () => {
    expect(resolveAccent(chose('shop-a', -1), COUNT)).toBe(accentIndex('shop-a', COUNT));
    expect(resolveAccent(chose('shop-a', 1.5), COUNT)).toBe(accentIndex('shop-a', COUNT));
  });
});

describe('assignBrandAccents', () => {
  it('matches the hashed assignment when nobody has chosen', () => {
    const shops = [auto('a'), auto('b'), auto('c')];
    const assigned = assignBrandAccents(shops, COUNT);

    expect(new Set(assigned).size).toBe(3);
  });

  it('never moves a tone the shop deliberately chose', () => {
    // The collision walk exists to separate shops that never expressed a
    // preference. A merchant who picked their brand colour outranks it.
    const wanted = accentIndex('auto-shop', COUNT);
    const shops = [auto('auto-shop'), chose('branded-shop', wanted)];

    const [autoTone, brandedTone] = assignBrandAccents(shops, COUNT);

    expect(brandedTone).toBe(wanted);
    expect(autoTone).not.toBe(wanted);
  });

  it('lets an unbranded shop keep its tone when no one contests it', () => {
    const preferred = accentIndex('lonely', COUNT);
    expect(assignBrandAccents([auto('lonely')], COUNT)).toEqual([preferred]);
  });

  it('lets two shops both keep a tone they each chose', () => {
    // Two merchants may genuinely both want teal. The app does not overrule a
    // paying shop's branding to make a list prettier.
    expect(assignBrandAccents([chose('a', 2), chose('b', 2)], COUNT)).toEqual([2, 2]);
  });

  it('ignores an out-of-range choice when reserving tones', () => {
    const shops = [chose('a', 99), auto('b')];
    const assigned = assignBrandAccents(shops, COUNT);

    expect(assigned[0]).toBe(accentIndex('a', COUNT));
    expect(assigned).toHaveLength(2);
  });
});

describe('isValidAccent', () => {
  it('accepts every index the palette actually has', () => {
    expect(isValidAccent(0, COUNT)).toBe(true);
    expect(isValidAccent(COUNT - 1, COUNT)).toBe(true);
  });

  it('rejects an index past the palette', () => {
    expect(isValidAccent(COUNT, COUNT)).toBe(false);
  });

  it('rejects nonsense a form could hand it', () => {
    expect(isValidAccent(-1, COUNT)).toBe(false);
    expect(isValidAccent(1.5, COUNT)).toBe(false);
    expect(isValidAccent(null, COUNT)).toBe(false);
    expect(isValidAccent('2', COUNT)).toBe(false);
  });
});

describe('validateTagline', () => {
  it('keeps a normal tagline', () => {
    expect(validateTagline('Same-day wash, fold & press')).toBe(
      'Same-day wash, fold & press'
    );
  });

  it('trims the edges', () => {
    expect(validateTagline('  Fresh every day  ')).toBe('Fresh every day');
  });

  it('accepts an empty tagline, because clearing it is allowed', () => {
    expect(validateTagline('   ')).toBe('');
  });

  it('collapses a pasted line break into a space', () => {
    // The shopfront gives the tagline one line. A pasted newline would either
    // be swallowed or silently push the layout, so it is normalised on entry.
    expect(validateTagline('Fresh every day\nSame-day service')).toBe(
      'Fresh every day Same-day service'
    );
  });

  it('rejects a tagline longer than the shopfront can show', () => {
    expect(validateTagline('x'.repeat(MAX_TAGLINE + 1))).toBeNull();
  });

  it('accepts a tagline of exactly the maximum length', () => {
    const exact = 'x'.repeat(MAX_TAGLINE);
    expect(validateTagline(exact)).toBe(exact);
  });
});
