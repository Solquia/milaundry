import {
  CROWN,
  FONT,
  RADII,
  ROLE_ORDER,
  TYPE_ROLES,
  fontFor,
} from '../design-scale';

describe('FONT', () => {
  it('names a family for every weight the roles ask for', () => {
    for (const role of Object.values(TYPE_ROLES)) {
      expect(Object.values(FONT)).toContain(role.fontFamily);
    }
  });

  it('maps a numeric weight to its own file rather than leaning on fontWeight', () => {
    expect(fontFor(400)).toBe(FONT.regular);
    expect(fontFor(600)).toBe(FONT.semibold);
    expect(fontFor(800)).toBe(FONT.extrabold);
  });

  it('rounds an in-between weight to the nearest cut it actually ships', () => {
    expect(fontFor(450)).toBe(FONT.medium);
    expect(fontFor(1000)).toBe(FONT.extrabold);
    expect(fontFor(100)).toBe(FONT.regular);
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

  it('sets body at the 16px reading floor', () => {
    expect(TYPE_ROLES.body.fontSize).toBeGreaterThanOrEqual(16);
  });

  it('keeps display tracking tight and never below the -0.04em floor', () => {
    for (const role of Object.values(TYPE_ROLES)) {
      expect(role.letterSpacing).toBeGreaterThanOrEqual(role.fontSize * -0.04);
    }
  });

  it('separates neighbouring roles by enough to read as different jobs', () => {
    // The old scale ran 17/15/14, so screens overrode it constantly. Every
    // step now has to be worth making.
    const sizes = ROLE_ORDER.map((role) => TYPE_ROLES[role].fontSize);
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i - 1] - sizes[i]).toBeGreaterThanOrEqual(1);
    }
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
  it('rounds the head of a sheet more than its foot, so it reads as drawn', () => {
    expect(CROWN.borderTopLeftRadius).toBe(CROWN.borderTopRightRadius);
    expect(CROWN.borderBottomLeftRadius).toBe(CROWN.borderBottomRightRadius);
    expect(CROWN.borderTopLeftRadius).toBeGreaterThan(CROWN.borderBottomLeftRadius);
  });
});
