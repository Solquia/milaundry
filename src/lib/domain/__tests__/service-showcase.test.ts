import {
  showcaseBlurb,
  showcasePrice,
  showcaseTitle,
  showcaseTone,
} from '../service-showcase';
import { CATEGORY_ORDER } from '../service-catalog';
import type { StorefrontService } from '@/lib/types';

const washFold: StorefrontService = {
  id: 'wf',
  name: 'WASH AND FOLD',
  unit: 'per_kg',
  price: 176,
  category: 'wash_fold',
  min_quantity: 2,
  description: '',
  sort_order: 0,
};

const bedding: StorefrontService = {
  id: 'bed',
  name: 'Big beddings',
  unit: 'per_item',
  price: 123,
  category: 'special_items',
  min_quantity: 0,
  description: '  Comforters and thick blankets, washed on their own.  ',
  sort_order: 1,
};

const selfWash: StorefrontService = {
  id: 'self',
  name: 'Self-service wash (per load)',
  unit: 'flat',
  price: 75,
  category: 'self_service',
  min_quantity: 4,
  description: '',
  sort_order: 2,
};

describe('showcaseTitle', () => {
  it('reads a shouted name in title case', () => {
    expect(showcaseTitle('WASH AND FOLD')).toBe('Wash And Fold');
  });

  it('keeps a name the shop cased itself', () => {
    expect(showcaseTitle('Dry cleaning — Barong / Suit')).toBe('Dry cleaning — Barong / Suit');
  });

  it('keeps a short all-caps name that may be an acronym', () => {
    expect(showcaseTitle('DFW')).toBe('DFW');
  });

  it('trims stray whitespace', () => {
    expect(showcaseTitle('  Iron only ')).toBe('Iron only');
  });
});

describe('showcaseBlurb', () => {
  it('uses the shop’s own description, trimmed', () => {
    expect(showcaseBlurb(bedding)).toBe('Comforters and thick blankets, washed on their own.');
  });

  it('writes a line for a service the shop left undescribed', () => {
    expect(showcaseBlurb(washFold)).toBe('Washed, dried and folded, ready to wear.');
  });

  it('has a line for every category', () => {
    for (const category of CATEGORY_ORDER) {
      const blurb = showcaseBlurb({ ...washFold, category, description: '' });
      expect(blurb.length).toBeGreaterThan(10);
    }
  });
});

describe('showcasePrice', () => {
  it('splits a per-kg price into figure, unit and minimum', () => {
    expect(showcasePrice(washFold)).toEqual({
      figure: '₱176',
      symbol: '₱',
      amount: '176',
      unit: '/kg',
      minimum: '2 kg minimum',
    });
  });

  it('gives a per-item price its unit and no minimum', () => {
    expect(showcasePrice(bedding)).toEqual({
      figure: '₱123',
      symbol: '₱',
      amount: '123',
      unit: '/piece',
      minimum: null,
    });
  });

  it('shows a flat price as a bare figure, ignoring a stray minimum', () => {
    expect(showcasePrice(selfWash)).toEqual({
      figure: '₱75',
      symbol: '₱',
      amount: '75',
      unit: null,
      minimum: null,
    });
  });
});

describe('showcaseTone', () => {
  it('gives each category its own colour', () => {
    const backgrounds = CATEGORY_ORDER.map((category) => showcaseTone(category).bg);
    expect(new Set(backgrounds).size).toBe(CATEGORY_ORDER.length);
  });

  it('pairs each background with an ink', () => {
    for (const category of CATEGORY_ORDER) {
      const tone = showcaseTone(category);
      expect(tone.bg).toMatch(/^#[0-9A-F]{6}$/i);
      expect(tone.ink).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it('falls back to the other tone for a category it does not know', () => {
    expect(showcaseTone('mystery' as never)).toEqual(showcaseTone('other'));
  });
});

describe('showcasePrice symbol and amount', () => {
  it('splits the peso sign off the digits so each can be set on its own', () => {
    // Figtree has no peso glyph, so the browser substitutes another face for
    // it. Set at the same size and weight as the digits, that substitution
    // reads as a mistake; the card sets it smaller and lighter instead.
    expect(showcasePrice(washFold).symbol).toBe('₱');
    expect(showcasePrice(washFold).amount).toBe('176');
  });

  it('keeps the grouped thousands with the amount, not the symbol', () => {
    const pricey = { ...washFold, price: 2841 };
    expect(showcasePrice(pricey).symbol).toBe('₱');
    expect(showcasePrice(pricey).amount).toBe('2,841');
  });

  it('keeps centavos a shop really charges', () => {
    const odd = { ...washFold, price: 60.5 };
    expect(showcasePrice(odd).amount).toBe('60.50');
  });

  it('still offers the whole figure for anything that wants one string', () => {
    const price = showcasePrice(washFold);
    expect(price.figure).toBe(`${price.symbol}${price.amount}`);
  });
});

describe('the card ground each category brings', () => {
  /** WCAG relative luminance, so the assertions below are about real contrast. */
  function luminance(hex: string): number {
    const channels = [0, 2, 4].map((index) => parseInt(hex.slice(index + 1, index + 3), 16) / 255);
    const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }
  function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  const TEXT = '#14212E';
  const SUBTLE = '#5A6B7D';

  it('gives every category its own ground', () => {
    const fields = CATEGORY_ORDER.map((category) => showcaseTone(category).field);
    expect(new Set(fields).size).toBe(fields.length);
    for (const field of fields) expect(field).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('keeps every word on the card readable on it', () => {
    for (const category of CATEGORY_ORDER) {
      const tone = showcaseTone(category);
      // The name, the figure, and the unit beside it. AA body text is 4.5:1.
      expect(contrast(tone.ink, tone.field)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(TEXT, tone.field)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(SUBTLE, tone.field)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('stays a ground, not a block of the colour itself', () => {
    for (const category of CATEGORY_ORDER) {
      const tone = showcaseTone(category);
      // Far lighter than the tile the same hue paints at full strength, and
      // light enough that a white chip still reads as a chip on it.
      expect(luminance(tone.field)).toBeGreaterThan(luminance(tone.bg));
      expect(luminance(tone.field)).toBeGreaterThan(0.78);
      expect(contrast('#FFFFFF', tone.field)).toBeLessThan(1.25);
    }
  });
});
