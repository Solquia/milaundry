import { ENTRANCE, staggerDelay } from '../entrance';

describe('staggerDelay', () => {
  it('lets the first thing arrive immediately', () => {
    expect(staggerDelay(0, 70, 420)).toBe(0);
  });

  it('walks each following item one step further back', () => {
    expect(staggerDelay(1, 70, 420)).toBe(70);
    expect(staggerDelay(3, 70, 420)).toBe(210);
  });

  it('caps the wait, so a long price list does not animate into an empty screen', () => {
    // A shop with twenty services at 70ms each would have its last card arrive
    // 1.4s in — long after the customer has started scrolling, which reads as
    // the app lagging rather than as choreography.
    expect(staggerDelay(20, 70, 420)).toBe(420);
    expect(staggerDelay(999, 70, 420)).toBe(420);
  });

  it('never returns a negative delay', () => {
    // `Animated.delay` with a negative value throws on some drivers; an index
    // can go negative if a caller subtracts an offset for a pinned first row.
    expect(staggerDelay(-3, 70, 420)).toBe(0);
  });

  it('survives nonsense timings rather than stalling the entrance', () => {
    expect(staggerDelay(2, Number.NaN, 420)).toBe(0);
    expect(staggerDelay(2, 70, Number.NaN)).toBe(140);
  });
});

describe('ENTRANCE', () => {
  it('finishes fast enough to feel like arrival, not like waiting', () => {
    // Every cue starts within a third of a second and the whole thing is done
    // well inside a second; past that an entrance becomes a loading screen.
    for (const cue of Object.values(ENTRANCE)) {
      expect(cue.delay).toBeLessThanOrEqual(340);
      expect(cue.delay + cue.duration).toBeLessThanOrEqual(1100);
    }
  });

  it('leads with the field and follows with what sits on it', () => {
    // The gradient has to be there before the mark lands on it, or the mark
    // appears to fall onto nothing.
    expect(ENTRANCE.field.delay).toBeLessThan(ENTRANCE.mark.delay);
    expect(ENTRANCE.mark.delay).toBeLessThan(ENTRANCE.facts.delay);
  });
});
