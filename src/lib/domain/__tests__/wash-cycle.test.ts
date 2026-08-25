import { WASH_CYCLE_STAGES, washCycleProgress } from '../wash-cycle';

describe('WASH_CYCLE_STAGES', () => {
  it('walks the laundry from intake to ready in order', () => {
    expect(WASH_CYCLE_STAGES.map((stage) => stage.status)).toEqual([
      'received',
      'washing',
      'drying',
      'folded',
      'ready',
    ]);
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
      'current',
      'upcoming',
      'upcoming',
    ]);
  });

  it('reports how far along the cycle is', () => {
    // 'drying' is the 3rd of 5 stages.
    expect(washCycleProgress('drying').percent).toBe(60);
  });

  it('completes every stage once the laundry is handed back', () => {
    const progress = washCycleProgress('completed');
    expect(progress.steps.every((step) => step.state === 'done')).toBe(true);
    expect(progress.percent).toBe(100);
  });

  it('treats ready as the final in-cycle stage', () => {
    const progress = washCycleProgress('ready');
    expect(progress.steps[4].state).toBe('current');
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
