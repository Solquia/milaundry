import { WASH_CYCLE_STAGES, cycleStanding, washCycleProgress } from '../wash-cycle';

describe('cycleStanding', () => {
  it('counts the stage out of the whole cycle, so progress is a position', () => {
    expect(cycleStanding('drying')).toMatchObject({
      position: 4,
      total: 6,
      caption: 'Step 4 of 6',
    });
  });

  it('starts counting at the first stage of the cycle', () => {
    expect(cycleStanding('received').caption).toBe('Step 1 of 6');
  });

  it('counts sorting as its own step, between intake and the wash', () => {
    expect(cycleStanding('sorting')).toMatchObject({ position: 2, caption: 'Step 2 of 6' });
  });

  it('reaches the last step without overshooting it', () => {
    expect(cycleStanding('ready')).toMatchObject({ position: 6, caption: 'Step 6 of 6' });
  });

  it('says a booking has not started rather than calling it step zero', () => {
    expect(cycleStanding('pending')).toMatchObject({
      position: 0,
      caption: 'Not started yet',
    });
  });

  it('reports a finished load as done, not as a step', () => {
    expect(cycleStanding('completed')).toMatchObject({ position: 6, caption: 'All done' });
  });

  it('does not count a cancelled load through a cycle it left', () => {
    expect(cycleStanding('cancelled')).toMatchObject({
      position: 0,
      caption: 'Cancelled',
    });
  });

  it('knows a machine is actually turning during the wash and the dry', () => {
    expect(cycleStanding('washing').isRunning).toBe(true);
    expect(cycleStanding('drying').isRunning).toBe(true);
  });

  it('knows nothing is turning while the laundry only sits there', () => {
    for (const status of ['pending', 'received', 'sorting', 'folded', 'ready', 'completed'] as const) {
      expect(cycleStanding(status).isRunning).toBe(false);
    }
  });

  it('counts the same stages the tracker draws', () => {
    // The rail and the dots must never disagree about how long the cycle is.
    expect(cycleStanding('washing').total).toBe(WASH_CYCLE_STAGES.length);
  });
});

describe('WASH_CYCLE_STAGES', () => {
  it('walks the laundry from intake to ready in order', () => {
    expect(WASH_CYCLE_STAGES.map((stage) => stage.status)).toEqual([
      'received',
      'sorting',
      'washing',
      'drying',
      'folded',
      'ready',
    ]);
  });

  it('shows sorting with its own label and icon', () => {
    expect(WASH_CYCLE_STAGES[1]).toEqual({ status: 'sorting', label: 'Sorting', icon: 'shirt-outline' });
  });

  it('gives every stage a customer-facing label and icon', () => {
    for (const stage of WASH_CYCLE_STAGES) {
      expect(stage.label.length).toBeGreaterThan(0);
      expect(stage.icon.length).toBeGreaterThan(0);
    }
  });
});

describe('washCycleProgress', () => {
  it('shows nothing started while the booking is still pending', () => {
    const progress = washCycleProgress('pending');
    expect(progress.steps.every((step) => step.state === 'upcoming')).toBe(true);
    expect(progress.percent).toBe(0);
  });

  it('marks the current stage and everything before it', () => {
    const progress = washCycleProgress('drying');
    expect(progress.steps.map((step) => step.state)).toEqual([
      'done',
      'done',
      'done',
      'current',
      'upcoming',
      'upcoming',
    ]);
  });

  it('reports how far along the cycle is', () => {
    // 'drying' is the 4th of 6 stages.
    expect(washCycleProgress('drying').percent).toBe(67);
  });

  it('completes every stage once the laundry is handed back', () => {
    const progress = washCycleProgress('completed');
    expect(progress.steps.every((step) => step.state === 'done')).toBe(true);
    expect(progress.percent).toBe(100);
  });

  it('treats ready as the final in-cycle stage', () => {
    const progress = washCycleProgress('ready');
    expect(progress.steps[5].state).toBe('current');
    expect(progress.percent).toBe(100);
  });

  it('flags cancelled orders instead of showing progress', () => {
    const progress = washCycleProgress('cancelled');
    expect(progress.isCancelled).toBe(true);
    expect(progress.percent).toBe(0);
    expect(progress.steps.every((step) => step.state === 'upcoming')).toBe(true);
  });

  it('is not cancelled for a normal in-progress order', () => {
    expect(washCycleProgress('washing').isCancelled).toBe(false);
  });
});
