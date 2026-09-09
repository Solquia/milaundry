import { serviceIcon } from '../service-icon';

describe('serviceIcon', () => {
  it('gives the three bedding services three readings of the same idea', () => {
    // The storefront drew `categoryIcon` on every row, so a shop with three
    // bedding services printed the same bed glyph three times where three
    // different things should have been.
    expect(serviceIcon('Comforter (queen / king, thick)', 'special_items')).toBe(
      'bed-outline'
    );
    expect(serviceIcon('Curtains', 'special_items')).not.toBe('bed-outline');
  });

  it('reads the machine a self-service load actually uses', () => {
    expect(serviceIcon('Self-service wash (per load)', 'self_service')).toBe(
      'water-outline'
    );
    expect(serviceIcon('Self-service dry (per load)', 'self_service')).toBe(
      'sunny-outline'
    );
  });

  it('calls a wash-and-fold service clothes, not water', () => {
    // "Wash, Dry & Fold" contains all three words. What the customer hands over
    // is a bag of clothes, so the fold wins over the machinery.
    expect(serviceIcon('Wash, Dry & Fold', 'wash_fold')).toBe('shirt-outline');
  });

  it('lets pressing outrank the wash it is bundled with', () => {
    expect(serviceIcon('Wash, Dry & Iron', 'wash_fold')).toBe('flame-outline');
    expect(serviceIcon('Ironing only', 'ironing')).toBe('flame-outline');
  });

  it('keeps dry cleaning away from the dryer', () => {
    // "Dry cleaning" contains "dry". Matching it as a dryer service would put a
    // sun on the most delicate thing the shop handles.
    expect(serviceIcon('Dry cleaning — Barong / Suit', 'dry_cleaning')).toBe(
      'sparkles-outline'
    );
    expect(serviceIcon('Dry cleaning — Gown', 'dry_cleaning')).toBe('sparkles-outline');
  });

  it('ignores case and punctuation the owner happened to type', () => {
    expect(serviceIcon('CURTAINS', 'other')).toBe(serviceIcon('curtains', 'other'));
    expect(serviceIcon('  Comforter/Blanket  ', 'other')).toBe('bed-outline');
  });

  it('falls back to the category when the name says nothing it knows', () => {
    // Owners type their own service names. An unrecognised one must still get a
    // glyph, and the category is the best thing left to ask.
    expect(serviceIcon('Rush handling fee', 'ironing')).toBe('flame-outline');
    expect(serviceIcon('', 'wash_fold')).toBe('shirt-outline');
  });

  it('never returns an empty glyph, whatever it is handed', () => {
    const names = ['', '   ', '🧺', 'x'.repeat(200), '—'];
    for (const name of names) {
      expect(serviceIcon(name, 'other').length).toBeGreaterThan(0);
    }
  });
});
