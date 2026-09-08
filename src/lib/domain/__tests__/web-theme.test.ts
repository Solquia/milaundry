import { ACCENTS } from '@/components/ui-kit';

import { contrastRatio, storefrontTheme } from '../web-theme';

const AA_TEXT = 4.5;

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0);
    expect(contrastRatio('#1263AF', '#1263AF')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1263AF', '#E8F1FC')).toBeCloseTo(
      contrastRatio('#E8F1FC', '#1263AF'),
      5
    );
  });
});

describe('storefrontTheme', () => {
  it.each(ACCENTS.map((accent, index) => [index, accent]))(
    'accent %i reads on its own field and on white',
    (_index, accent) => {
      const theme = storefrontTheme(accent);
      expect(contrastRatio(theme.onBrand, theme.brand)).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(theme.brand, '#FFFFFF')).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(theme.brandInk, theme.brandSoft)).toBeGreaterThanOrEqual(AA_TEXT);
    }
  );

  it('keeps the shop tone as the brand and the pale tone as the soft field', () => {
    const theme = storefrontTheme({ surface: '#DCF2EE', ink: '#0F6B5F' });
    expect(theme.brand).toBe('#0F6B5F');
    expect(theme.brandSoft).toBe('#DCF2EE');
  });
});
