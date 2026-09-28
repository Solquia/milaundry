import { dailyTotals, dayKey, goalProgress, parseGoal, shouldCelebrate, suggestGoals } from '../sales-goal';

describe('the daily goal', () => {
  it('reads a goal typed with commas or a peso sign', () => {
    expect(parseGoal('6,400')).toBe(6400);
    expect(parseGoal('₱5000')).toBe(5000);
    expect(parseGoal('0')).toBeNull();
    expect(parseGoal('lots')).toBeNull();
  });

  it('measures progress and what is left', () => {
    expect(goalProgress(4860, 6400)).toEqual({ ratio: 4860 / 6400, pct: 76, remaining: 1540, isHit: false });
    expect(goalProgress(7000, 6400)).toMatchObject({ ratio: 1, pct: 109, remaining: 0, isHit: true });
  });

  it('celebrates once a day, the first time the goal is hit', () => {
    const day = dayKey(new Date(2026, 8, 28, 15));
    expect(day).toBe('2026-09-28');
    expect(shouldCelebrate(true, null, day)).toBe(true);
    expect(shouldCelebrate(true, day, day)).toBe(false);
    expect(shouldCelebrate(true, '2026-09-27', day)).toBe(true);
    expect(shouldCelebrate(false, null, day)).toBe(false);
  });
});

describe('suggested goals', () => {
  const NOW = new Date(2026, 8, 28, 15);
  const paid = (d: number, amount: number) => ({
    status: 'completed' as const,
    payment_status: 'paid' as const,
    paid_at: new Date(2026, 8, d, 12).toISOString(),
    estimated_total: amount,
    final_total: null,
  });

  it('adds up each finished day, leaving today out', () => {
    const totals = dailyTotals([paid(27, 1000), paid(27, 500), paid(26, 800), paid(28, 9999)], NOW, 3);
    expect(totals).toEqual([0, 800, 1500]);
  });

  it('offers the usual day, a stretch and a big day, rounded up to ₱500', () => {
    expect(suggestGoals([0, 3900, 4100])).toEqual([4000, 5000, 6000]);
  });

  it('falls back to round starter figures for a new shop', () => {
    expect(suggestGoals([0, 0])).toEqual([3000, 5000, 8000]);
  });
});
