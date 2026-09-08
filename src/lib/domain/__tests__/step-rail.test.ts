import {
  nextStep,
  previousStep,
  stepAnnouncement,
  stepRail,
} from '../step-rail';

/** The three steps of placing an order, in the order they are asked. */
const STEPS = [
  { key: 'items', label: 'Items' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'review', label: 'Review' },
] as const;

describe('stepRail', () => {
  it('numbers each step in the label, so the rail counts out loud', () => {
    // The bars this replaces said "there is more after this" and nothing else.
    // A number and a name say how many are left and what they will ask.
    expect(stepRail(STEPS, 'items').map((tab) => tab.label)).toEqual([
      '1. Items',
      '2. Schedule',
      '3. Review',
    ]);
  });

  it('marks the step you are on, what is behind it, and what is ahead', () => {
    expect(stepRail(STEPS, 'schedule').map((tab) => tab.state)).toEqual([
      'done',
      'current',
      'upcoming',
    ]);
  });

  it('lets you go back to a step you finished, but never skip ahead', () => {
    // Tapping "3. Review" from step one would jump a validation gate. Tapping
    // "1. Items" from step two is just changing your mind about the laundry.
    expect(stepRail(STEPS, 'schedule').map((tab) => tab.canGo)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it('has nothing behind it on the first step', () => {
    expect(stepRail(STEPS, 'items').map((tab) => tab.state)).toEqual([
      'current',
      'upcoming',
      'upcoming',
    ]);
  });

  it('leaves nothing ahead on the last step', () => {
    expect(stepRail(STEPS, 'review').map((tab) => tab.state)).toEqual([
      'done',
      'done',
      'current',
    ]);
  });

  it('treats a step it does not know as no step at all', () => {
    // A rail that guessed would light the wrong tab, which is worse than a
    // rail that lights none: the customer would trust the wrong count.
    const rail = stepRail(STEPS, 'nowhere' as never);
    expect(rail.every((tab) => tab.state === 'upcoming')).toBe(true);
    expect(rail.every((tab) => tab.canGo === false)).toBe(true);
  });
});

describe('stepAnnouncement', () => {
  it('says the position and the name, because a screen reader cannot see the underline', () => {
    expect(stepAnnouncement(STEPS, 'schedule')).toBe('Step 2 of 3: Schedule');
  });

  it('says nothing when the step is not on the rail', () => {
    expect(stepAnnouncement(STEPS, 'nowhere' as never)).toBe('');
  });
});

describe('nextStep', () => {
  it('advances one step', () => {
    expect(nextStep(STEPS, 'items')).toBe('schedule');
  });

  it('stops at the end rather than wrapping to the start', () => {
    // Wrapping would turn "Place order" into "back to the top" — the one tap
    // in this flow that must never be ambiguous.
    expect(nextStep(STEPS, 'review')).toBeNull();
  });
});

describe('previousStep', () => {
  it('goes back one step', () => {
    expect(previousStep(STEPS, 'review')).toBe('schedule');
  });

  it('has nowhere to go from the first step', () => {
    expect(previousStep(STEPS, 'items')).toBeNull();
  });
});
