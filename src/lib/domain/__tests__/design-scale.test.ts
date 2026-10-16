import {
  CROWN,
  INTER,
  RADII,
  ROLE_ORDER,
  TYPE_ROLES,
  WEB_FONT_STACK,
  fontForPlatform,
  nearestCut,
} from '../design-scale';

describe('nearestCut', () => {
  it('keeps a weight the faces ship', () => {
    expect(nearestCut(400)).toBe(400);
    expect(nearestCut(600)).toBe(600);
    expect(nearestCut(800)).toBe(800);
  });

  it('rounds an in-between weight to the nearest cut, heavier on a tie', () => {
    expect(nearestCut(450)).toBe(500);
    expect(nearestCut(1000)).toBe(800);
    expect(nearestCut(100)).toBe(400);
  });
});

describe('fontForPlatform', () => {
  it('hands iOS the system face, so an iPhone reads San Francisco', () => {
    expect(fontForPlatform(700, 'ios')).toEqual({ fontFamily: 'System', fontWeight: '700' });
  });

  it('hands Android a bundled Inter cut by family, never a synthesised weight', () => {
    expect(fontForPlatform(600, 'android')).toEqual({ fontFamily: INTER[600] });
    expect(fontForPlatform(600, 'android')).not.toHaveProperty('fontWeight');
  });

  it('hands the web a stack that starts with the Apple system face', () => {
    const style = fontForPlatform(400, 'web');
    expect(style.fontWeight).toBe('400');
    expect(style.fontFamily).toBe(WEB_FONT_STACK);
    expect(WEB_FONT_STACK.startsWith('-apple-system')).toBe(true);
    expect(WEB_FONT_STACK).toContain('Inter');
  });
});

describe('TYPE_ROLES', () => {
  it('steps down in size from hero to caption with no ties', () => {
    const sizes = ROLE_ORDER.map((role) => TYPE_ROLES[role].fontSize);
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    }
  });

  it('gives every role a line height with room to breathe', () => {
    for (const role of Object.values(TYPE_ROLES)) {
      expect(role.lineHeight).toBeGreaterThanOrEqual(role.fontSize * 1.15);
    }
  });

  it('opens on the iOS large title and reads body at 16 or more', () => {
    expect(TYPE_ROLES.hero.fontSize).toBe(34);
    expect(TYPE_ROLES.body.fontSize).toBeGreaterThanOrEqual(16);
  });

  it('tracks tighter as the size grows, never past the -0.04em floor', () => {
    for (const role of Object.values(TYPE_ROLES)) {
      expect(role.letterSpacing).toBeGreaterThanOrEqual(role.fontSize * -0.04);
      expect(role.letterSpacing).toBeLessThanOrEqual(0);
    }
    expect(TYPE_ROLES.hero.letterSpacing).toBeLessThan(TYPE_ROLES.body.letterSpacing);
  });

  it('separates a section heading from body by a visible step', () => {
    expect(TYPE_ROLES.section.fontSize - TYPE_ROLES.body.fontSize).toBeGreaterThanOrEqual(3);
  });
});

describe('RADII', () => {
  it('runs from the tightest detail to a full pill', () => {
    expect(RADII.hair).toBeLessThan(RADII.chip);
    expect(RADII.chip).toBeLessThan(RADII.control);
    expect(RADII.control).toBeLessThan(RADII.card);
    expect(RADII.card).toBeLessThan(RADII.sheet);
    expect(RADII.pill).toBe(999);
  });

  it('is soft enough that a card never reads as a rectangle', () => {
    expect(RADII.card).toBeGreaterThanOrEqual(18);
  });
});

describe('CROWN', () => {
  it('is one even, continuous corner, the way iOS draws a card', () => {
    expect(CROWN.borderRadius).toBe(RADII.card);
    expect(CROWN.borderCurve).toBe('continuous');
  });
});
