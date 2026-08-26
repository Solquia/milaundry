import {
  HAPTIC_INTENTS,
  hapticEffectFor,
  type HapticIntent,
} from '../haptic-feedback';

describe('hapticEffectFor', () => {
  it('gives a light tap the lightest impact there is', () => {
    expect(hapticEffectFor('tap', true)).toEqual({ kind: 'impact', style: 'Light' });
  });

  it('gives a commitment more weight than a tap', () => {
    expect(hapticEffectFor('commit', true)).toEqual({ kind: 'impact', style: 'Medium' });
  });

  it('uses the selection tick for a toggle, not an impact', () => {
    expect(hapticEffectFor('select', true)).toEqual({ kind: 'selection' });
  });

  it('marks a finished action as success and a refused one as error', () => {
    expect(hapticEffectFor('success', true)).toEqual({
      kind: 'notification',
      type: 'Success',
    });
    expect(hapticEffectFor('warning', true)).toEqual({
      kind: 'notification',
      type: 'Warning',
    });
    expect(hapticEffectFor('error', true)).toEqual({
      kind: 'notification',
      type: 'Error',
    });
  });

  it('is silent for every intent once the customer turns haptics off', () => {
    for (const intent of HAPTIC_INTENTS) {
      expect(hapticEffectFor(intent, false)).toBeNull();
    }
  });

  it('has an effect for every intent it advertises', () => {
    for (const intent of HAPTIC_INTENTS) {
      expect(hapticEffectFor(intent, true)).not.toBeNull();
    }
  });

  it('is silent rather than guessing when the intent is not one it knows', () => {
    expect(hapticEffectFor('shimmy' as HapticIntent, true)).toBeNull();
  });
});
