import { COLORWAYS, serviceLook, serviceLooks, traitColorway } from '../service-look';
import type { ServiceCategory } from '../service-catalog';
import type { PricingUnit } from '../pricing';

const svc = (id: string, name: string, category: ServiceCategory = 'wash_fold', unit: PricingUnit = 'per_kg') => ({
  id,
  name,
  category,
  unit,
});

describe('traitColorway', () => {
  it('reads the fabric a name is about', () => {
    expect(traitColorway('Wash & Fold — Whites')).toBe('whites');
    expect(traitColorway('Delicates / Lingerie')).toBe('delicates');
    expect(traitColorway('Maong & Jeans')).toBe('denim');
    expect(traitColorway('Baby clothes')).toBe('baby');
    expect(traitColorway('Dark colors')).toBe('darks');
  });

  it('says nothing about a name with no fabric in it', () => {
    expect(traitColorway('Wash & Fold')).toBeNull();
  });
});

describe('serviceLook', () => {
  it('keeps the house dyes for a plain service', () => {
    expect(serviceLook('Wash & Fold', 'wash_fold')).toEqual({ scene: 'stack', colorway: 'mixed', tag: null });
  });

  it('dyes a service by its fabric even when it stands alone', () => {
    expect(serviceLook('Whites', 'wash_fold').colorway).toBe('whites');
  });
});

describe('serviceLooks', () => {
  it('leaves services that already look different alone', () => {
    const looks = serviceLooks([svc('a', 'Wash & Fold'), svc('b', 'Comforter', 'special_items')]);
    expect(looks.get('a')).toEqual({ scene: 'stack', colorway: 'mixed', tag: null });
    expect(looks.get('b')?.tag).toBeNull();
  });

  it('gives every sibling on the same drawing its own colorway', () => {
    const looks = serviceLooks([
      svc('a', 'Wash & Fold (Regular Clothes)'),
      svc('b', 'Wash & Fold (Office Clothes)'),
      svc('c', 'Wash & Fold (Towels)'),
    ]);
    const colorways = ['a', 'b', 'c'].map((id) => looks.get(id)?.colorway);
    expect(new Set(colorways).size).toBe(3);
    expect(colorways[0]).toBe('mixed');
  });

  it('lets a named fabric claim its colorway before the others are handed out', () => {
    const looks = serviceLooks([svc('a', 'Wash & Fold'), svc('b', 'Wash & Fold Whites')]);
    expect(looks.get('b')?.colorway).toBe('whites');
    expect(looks.get('a')?.colorway).toBe('mixed');
  });

  it('tags each sibling with the words that set it apart', () => {
    const looks = serviceLooks([
      svc('a', 'Wash & Fold (Regular Clothes)'),
      svc('b', 'Wash & Fold (Delicates)'),
    ]);
    expect(looks.get('a')?.tag).toBe('Regular Clothes');
    expect(looks.get('b')?.tag).toBe('Delicates');
  });

  it('falls back to the unit when two names are the same', () => {
    const looks = serviceLooks([
      svc('a', 'Wash & Fold', 'wash_fold', 'per_kg'),
      svc('b', 'Wash & Fold', 'wash_fold', 'per_item'),
    ]);
    expect(looks.get('a')?.tag).toBe('Per kg');
    expect(looks.get('b')?.tag).toBe('Per piece');
    expect(looks.get('a')?.colorway).not.toBe(looks.get('b')?.colorway);
  });

  it('keeps a tag short enough to sit on a card', () => {
    const looks = serviceLooks([
      svc('a', 'Wash & Fold'),
      svc('b', 'Wash & Fold extra gentle cycle for handmade items'),
    ]);
    expect((looks.get('b')?.tag ?? '').length).toBeLessThanOrEqual(18);
  });

  it('cycles colorways rather than running out on a long list', () => {
    const many = Array.from({ length: 14 }, (_, i) => svc(String(i), `Fold ${i}`));
    const looks = serviceLooks(many);
    for (const entry of many) expect(COLORWAYS[looks.get(entry.id)!.colorway]).toBeDefined();
  });
});
