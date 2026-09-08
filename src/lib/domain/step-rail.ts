/**
 * The rail across the top of a multi-step form: what it says, and where it
 * lets you go.
 *
 * Both booking flows used to show progress as flat bars — two on the native
 * screen, three on the web page — filled left to right. A bar can say "there
 * is more after this" and nothing else. It cannot say how much more, what the
 * next question will be, or that the answer you already gave is still yours to
 * change. So a customer three taps in had no way to know whether they were
 * nearly done or barely started, and no way back except a Back button that
 * only ever moved one step.
 *
 * A numbered, named rail says all of it in one line: "1. Items  2. Schedule
 * 3. Review", the reached ones underlined, the rest greyed. It is also a
 * control — a finished step is a door back to itself.
 *
 * The rule that makes it safe is here rather than in the component: you may
 * walk back to a step you finished, and you may never skip forward past one.
 * Skipping forward would jump a validation gate; walking back is just changing
 * your mind about the laundry. Two screens render this rail, and a rule that
 * lives in one of them is a rule the other will eventually break.
 */

/** Behind you, under you, or still ahead. */
export type StepState = 'done' | 'current' | 'upcoming';

/** A step as the rail declares it: a key to switch on, a name to show. */
export interface StepSpec<K extends string> {
  key: K;
  label: string;
}

export interface StepTab<K extends string> {
  key: K;
  /**
   * "2. Schedule" — the number is part of the label rather than a separate
   * badge, so it wraps, truncates and is spoken as one thing.
   */
  label: string;
  state: StepState;
  /** Whether tapping this tab should move the form. */
  canGo: boolean;
}

/** Where `current` sits, or -1 when it is not a step this rail knows. */
function indexOfStep<K extends string>(steps: readonly StepSpec<K>[], current: K): number {
  return steps.findIndex((step) => step.key === current);
}

/**
 * The rail, one tab per step.
 *
 * An unrecognised `current` lights nothing and unlocks nothing. A rail that
 * guessed would underline the wrong tab, and a customer who trusts a wrong
 * count is worse off than one shown no count at all.
 */
export function stepRail<K extends string>(
  steps: readonly StepSpec<K>[],
  current: K
): StepTab<K>[] {
  const here = indexOfStep(steps, current);

  return steps.map((step, index) => {
    const state: StepState =
      here === -1 ? 'upcoming' : index < here ? 'done' : index === here ? 'current' : 'upcoming';

    return {
      key: step.key,
      label: `${index + 1}. ${step.label}`,
      state,
      canGo: state === 'done',
    };
  });
}

/**
 * The rail said out loud: "Step 2 of 3: Schedule".
 *
 * An underline is invisible to a screen reader, and the numbered labels alone
 * leave it to the listener to count the tabs. This is the header's own label.
 */
export function stepAnnouncement<K extends string>(
  steps: readonly StepSpec<K>[],
  current: K
): string {
  const here = indexOfStep(steps, current);
  if (here === -1) return '';

  return `Step ${here + 1} of ${steps.length}: ${steps[here].label}`;
}

/**
 * The step after this one, or null at the end.
 *
 * Never wraps. Wrapping would turn the last tap in the flow — the one that
 * places the order — into a jump back to the top, which is the one ambiguity
 * this screen cannot afford.
 */
export function nextStep<K extends string>(
  steps: readonly StepSpec<K>[],
  current: K
): K | null {
  const here = indexOfStep(steps, current);
  if (here === -1 || here >= steps.length - 1) return null;

  return steps[here + 1].key;
}

/** The step before this one, or null at the start. */
export function previousStep<K extends string>(
  steps: readonly StepSpec<K>[],
  current: K
): K | null {
  const here = indexOfStep(steps, current);
  if (here <= 0) return null;

  return steps[here - 1].key;
}
