import { CATEGORY_ORDER } from '../service-catalog';
import { SCENE_KEYS, sceneFaces, sceneFor } from '../service-scene';

describe('sceneFor', () => {
  it('reads the scene from the service name before its category', () => {
    expect(sceneFor('Shoe cleaning', 'other')).toBe('shoes');
    expect(sceneFor('Curtains', 'special_items')).toBe('curtain');
  });

  it('lets the most specific name win over a word it contains', () => {
    // "Wash, Dry & Fold" holds wash, dry and fold; the fold is what arrives.
    expect(sceneFor('Wash, Dry & Fold', 'wash_fold')).toBe('stack');
    // "Dry cleaning" holds "dry"; it is not a drying service.
    expect(sceneFor('Dry cleaning — Barong / Suit', 'dry_cleaning')).toBe('suit');
    // A service that presses is a pressing service even when it washes first.
    expect(sceneFor('Wash and press', 'wash_fold')).toBe('iron');
  });

  it('falls back to the category when the name says nothing', () => {
    expect(sceneFor('Package A', 'self_service')).toBe('machine');
    expect(sceneFor('Package A', 'special_items')).toBe('bed');
    expect(sceneFor('Package A', 'ironing')).toBe('iron');
  });

  it('has a scene for every category', () => {
    for (const category of CATEGORY_ORDER) {
      expect(SCENE_KEYS).toContain(sceneFor('', category));
    }
  });

  it('is case-insensitive about the name', () => {
    expect(sceneFor('BIG BEDDINGS', 'other')).toBe('bed');
  });
});

describe('sceneFaces', () => {
  const faces = sceneFaces('#2B7FE0');

  it('returns hex colours for every face of the diorama', () => {
    for (const value of Object.values(faces)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('lights the top face and shades the right, so the box reads as a solid', () => {
    const brightness = (hex: string) =>
      parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(brightness(faces.top)).toBeGreaterThan(brightness(faces.left));
    expect(brightness(faces.left)).toBeGreaterThan(brightness(faces.right));
  });

  it('keeps the tile gradient lighter at the top than at the foot', () => {
    const brightness = (hex: string) =>
      parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
    expect(brightness(faces.skyTop)).toBeGreaterThan(brightness(faces.skyFoot));
  });

  it('is deterministic', () => {
    expect(sceneFaces('#2B7FE0')).toEqual(sceneFaces('#2B7FE0'));
  });

  it('survives a colour it cannot read', () => {
    expect(() => sceneFaces('rebeccapurple')).not.toThrow();
    for (const value of Object.values(sceneFaces('rebeccapurple'))) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('sceneFaces on a white card', () => {
  const onTile = sceneFaces('#2B7FE0');
  const onWhite = sceneFaces('#2B7FE0', 'white');
  const brightness = (hex: string) =>
    parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);

  it('keeps the same light source: top lit, right shaded', () => {
    expect(brightness(onWhite.top)).toBeGreaterThan(brightness(onWhite.left));
    expect(brightness(onWhite.left)).toBeGreaterThan(brightness(onWhite.right));
  });

  it('paints the object in its own colour rather than near-white', () => {
    // On a coloured tile the object is white and the tile carries the hue. On
    // a white card that reads as a hole, so the object has to carry the hue.
    expect(brightness(onWhite.top)).toBeLessThan(brightness(onTile.top));
    expect(brightness(onWhite.top)).toBeLessThan(255 * 3 * 0.94);
  });

  it('drops the tile, so nothing paints a panel behind the object', () => {
    expect(onWhite.skyTop).toBe('transparent');
    expect(onWhite.skyFoot).toBe('transparent');
  });

  it('still returns hex for every face that paints one', () => {
    for (const key of ['top', 'left', 'right', 'shadow', 'rim'] as const) {
      expect(onWhite[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
