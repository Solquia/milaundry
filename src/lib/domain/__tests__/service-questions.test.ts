import { questionsFor } from '../service-questions';

describe('questionsFor', () => {
  it('asks a wash every question: soap, fabcon, whites, delicates, drying, notes', () => {
    const q = questionsFor('wash_fold', 'per_kg');
    expect(q.preferences).toEqual([
      'detergent',
      'softener',
      'separate_whites',
      'delicates',
      'air_dry',
      'instructions',
    ]);
    expect(q.addonKinds).toEqual(['detergent', 'fabcon', 'extra']);
    expect(q.offersHeavyItems).toBe(true);
  });

  it('never asks ironing about soap, fabcon, whites or drying', () => {
    const q = questionsFor('ironing', 'per_item');
    expect(q.preferences).not.toContain('detergent');
    expect(q.preferences).not.toContain('softener');
    expect(q.preferences).not.toContain('separate_whites');
    expect(q.preferences).not.toContain('air_dry');
    expect(q.preferences).toContain('instructions');
    expect(q.addonKinds).toEqual(['extra']);
    expect(q.offersHeavyItems).toBe(false);
    expect(q.title).toMatch(/press/i);
  });

  it('keeps dry cleaning to care notes and extras — there is no water or soap', () => {
    const q = questionsFor('dry_cleaning', 'per_item');
    expect(q.preferences).toEqual(['delicates', 'instructions']);
    expect(q.addonKinds).toEqual(['extra']);
    expect(q.offersHeavyItems).toBe(false);
  });

  it('washes bulky items with soap and fabcon, but has no whites to separate', () => {
    const q = questionsFor('special_items', 'per_item');
    expect(q.preferences).toEqual(['detergent', 'softener', 'air_dry', 'instructions']);
    expect(q.addonKinds).toEqual(['detergent', 'fabcon', 'extra']);
  });

  it('lets a self-service customer buy soap and fabcon, but asks nothing about how to wash', () => {
    const q = questionsFor('self_service', 'flat');
    expect(q.preferences).toEqual([]);
    expect(q.addonKinds).toEqual(['detergent', 'fabcon', 'extra']);
    expect(q.offersHeavyItems).toBe(false);
  });

  it('asks an unclassified service only for notes, plus extras', () => {
    const q = questionsFor('other', 'per_item');
    expect(q.preferences).toEqual(['instructions']);
    expect(q.addonKinds).toEqual(['extra']);
  });

  it('words delicates and the notes example for the service, not always for a wash', () => {
    expect(questionsFor('ironing', 'per_item').delicatesNote).toMatch(/low heat/i);
    expect(questionsFor('ironing', 'per_item').instructionsExample).not.toMatch(/wash/i);
    expect(questionsFor('wash_fold', 'per_kg').delicatesNote).toMatch(/gentle/i);
  });

  it('says the final price comes from the scale only for services sold by weight', () => {
    expect(questionsFor('wash_fold', 'per_kg').finalPriceNote).toMatch(/weighs/);
    expect(questionsFor('ironing', 'per_item').finalPriceNote).toMatch(/counts/);
    expect(questionsFor('self_service', 'flat').finalPriceNote).not.toMatch(/weighs|counts/);
  });
});
