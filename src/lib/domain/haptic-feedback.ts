/**
 * What the phone should do when a finger lands, expressed without touching
 * the haptics engine.
 *
 * The screens ask for an *intent* — "this was a tap", "this committed money",
 * "this failed" — and this module answers with the effect. Keeping the map
 * here rather than at each call site is what stops the app from drifting into
 * five different weights for the same class of press, which is how haptics
 * turn from feedback into noise.
 *
 * The customer's preference is an argument rather than a lookup, so the rule
 * "off means silent" is a property of the map itself and not something every
 * caller has to remember. `lib/haptics` performs whatever comes back.
 */

export type HapticIntent =
  /** An ordinary press: a card, a row, a nav control. */
  | 'tap'
  /** A press that commits something: book, pay, confirm. */
  | 'commit'
  /** A value changed: a switch, a segment, a quantity. */
  | 'select'
  | 'success'
  | 'warning'
  | 'error';

export const HAPTIC_INTENTS: readonly HapticIntent[] = [
  'tap',
  'commit',
  'select',
  'success',
  'warning',
  'error',
];

/** Mirrors expo-haptics' `ImpactFeedbackStyle` keys. */
export type ImpactStyle = 'Light' | 'Medium' | 'Heavy';
/** Mirrors expo-haptics' `NotificationFeedbackType` keys. */
export type NotificationType = 'Success' | 'Warning' | 'Error';

export type HapticEffect =
  | { kind: 'impact'; style: ImpactStyle }
  | { kind: 'notification'; type: NotificationType }
  | { kind: 'selection' };

/**
 * Only two weights of impact are used. A third would need a class of press
 * that is meaningfully heavier than committing an order, and there isn't one.
 */
const EFFECTS: Record<HapticIntent, HapticEffect> = {
  tap: { kind: 'impact', style: 'Light' },
  commit: { kind: 'impact', style: 'Medium' },
  select: { kind: 'selection' },
  success: { kind: 'notification', type: 'Success' },
  warning: { kind: 'notification', type: 'Warning' },
  error: { kind: 'notification', type: 'Error' },
};

/** The effect to perform, or null when nothing should happen. */
export function hapticEffectFor(
  intent: HapticIntent,
  isEnabled: boolean
): HapticEffect | null {
  if (!isEnabled) return null;
  return EFFECTS[intent] ?? null;
}
