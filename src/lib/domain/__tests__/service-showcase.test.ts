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
    expect(showcasePrice(washFold)).toEqual({ figure: '₱176', unit: '/kg', minimum: '2 kg minimum' });
  });

  it('gives a per-item price its unit and no minimum', () => {
    expect(showcasePrice(bedding)).toEqual({ figure: '₱123', unit: '/piece', minimum: null });
  });

  it('shows a flat price as a bare figure, ignoring a stray minimum', () => {
    expect(showcasePrice(selfWash)).toEqual({ figure: '₱75', unit: null, minimum: null });
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
