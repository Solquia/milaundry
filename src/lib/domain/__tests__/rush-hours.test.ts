import { RUSH_WEEKS, rushGrid } from '../rush-hours';

const NOW = new Date(2026, 8, 28, 14, 15); // Monday
const on = (d: number, h: number) => ({
  status: 'completed' as const,
  created_at: new Date(2026, 8, d, h, 10).toISOString(),
});

describe('rush hours', () => {
  it('says there is not enough to go on for a new shop', () => {
    const grid = rushGrid([on(26, 9)], NOW);
    expect(grid.insight).toBeNull();
    expect(grid.total).toBe(1);
  });

  it('finds the busiest two-hour window across the weeks', () => {
    const orders = [
      // Saturday 26 Sep and 19 Sep, 9–11 AM.
      ...Array.from({ length: 6 }, () => on(26, 9)),
      ...Array.from({ length: 5 }, () => on(19, 10)),
      on(22, 15),
      on(23, 8),
    ];
    const grid = rushGrid(orders, NOW);
    expect(grid.days).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(grid.cells[5][grid.hours.indexOf(9)]).toBe(6);
    expect(grid.insight).toBe('Saturdays 9–11 AM are your rush');
    expect(grid.peak).toMatchObject({ day: 5, startHour: 9 });
  });

  it('only looks back the set number of weeks and skips cancelled orders', () => {
    const old = { status: 'completed' as const, created_at: new Date(2026, 5, 1, 9).toISOString() };
    const cancelled = { ...on(26, 9), status: 'cancelled' as const };
    expect(rushGrid([old, cancelled], NOW).total).toBe(0);
    expect(RUSH_WEEKS).toBe(8);
  });

  it('keeps a working day on the axis even when nothing came in early or late', () => {
    const grid = rushGrid([on(26, 12)], NOW);
    expect(grid.hours[0]).toBe(7);
    expect(grid.hours[grid.hours.length - 1]).toBe(21);
  });
});

describe('stray orders at odd hours', () => {
  it('folds them into the edge columns instead of stretching the grid', () => {
    const grid = rushGrid([on(26, 2), on(26, 23), on(26, 12)], NOW);
    expect(grid.hours[0]).toBe(6);
    expect(grid.hours[grid.hours.length - 1]).toBe(22);
    expect(grid.cells[5][0]).toBe(1);
    expect(grid.total).toBe(3);
  });
});
