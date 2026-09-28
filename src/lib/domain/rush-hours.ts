/**
 * When the shop is busiest, from the orders of the last few weeks.
 *
 * A weekday × hour grid of orders taken, and the one sentence worth acting on:
 * the busiest two-hour stretch, so the owner knows when to put a second pair of
 * hands at the counter. A new shop gets the grid but no sentence — two orders
 * on a Tuesday is not a rush.
 */
import type { OrderStatus } from './order-status';

export const RUSH_WEEKS = 8;
/** Below this many orders in the window, a "rush" would be noise. */
export const RUSH_MIN_ORDERS = 10;
/** The axis always covers a working day, so a quiet shop's grid is not three columns wide. */
const DAY_OPENS = 7;
const DAY_CLOSES = 21;
const WINDOW_HOURS = 2;
/** The widest the axis may grow, so one 2 AM backfill cannot shrink every cell to a sliver. */
const EARLIEST = 6;
const LATEST = 22;
const clampHour = (hour: number): number => Math.min(LATEST, Math.max(EARLIEST, hour));

export interface RushOrder {
  status: OrderStatus;
  created_at: string;
}

export interface RushPeak {
  /** 0 is Monday. */
  day: number;
  startHour: number;
  count: number;
}

export interface RushGrid {
  days: string[];
  hours: number[];
  /** cells[day][hourIndex]: orders taken in that hour on that weekday. */
  cells: number[][];
  max: number;
  total: number;
  peak: RushPeak | null;
  insight: string | null;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_PLURALS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

const twelve = (hour: number): number => (hour % 12 === 0 ? 12 : hour % 12);
const meridiem = (hour: number): string => (hour % 24 < 12 ? 'AM' : 'PM');

/** "9–11 AM", "11 AM–1 PM". */
export function hourSpan(from: number, to: number): string {
  if (meridiem(from) === meridiem(to)) return `${twelve(from)}–${twelve(to)} ${meridiem(to)}`;
  return `${twelve(from)} ${meridiem(from)}–${twelve(to)} ${meridiem(to)}`;
}

export function rushGrid(orders: readonly RushOrder[], now: Date, weeks: number = RUSH_WEEKS): RushGrid {
  const since = now.getTime() - weeks * 7 * 86_400_000;
  const stamps = orders
    .filter((order) => order.status !== 'cancelled')
    .map((order) => new Date(order.created_at))
    .filter((date) => date.getTime() >= since && date.getTime() <= now.getTime());

  const first = Math.min(DAY_OPENS, ...stamps.map((date) => clampHour(date.getHours())));
  const last = Math.max(DAY_CLOSES, ...stamps.map((date) => clampHour(date.getHours())));
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const cells = DAYS.map(() => hours.map(() => 0));
  for (const date of stamps) cells[(date.getDay() + 6) % 7][clampHour(date.getHours()) - first] += 1;

  const peak = busiest(cells, hours);
  return {
    days: DAYS,
    hours,
    cells,
    max: Math.max(0, ...cells.flat()),
    total: stamps.length,
    peak,
    insight:
      peak && stamps.length >= RUSH_MIN_ORDERS
        ? `${DAY_PLURALS[peak.day]} ${hourSpan(peak.startHour, peak.startHour + WINDOW_HOURS)} are your rush`
        : null,
  };
}

function busiest(cells: number[][], hours: number[]): RushPeak | null {
  let best: RushPeak | null = null;
  cells.forEach((row, day) => {
    row.forEach((_, index) => {
      const count = row.slice(index, index + WINDOW_HOURS).reduce((sum, value) => sum + value, 0);
      if (count > 0 && (best === null || count > best.count)) {
        best = { day, startHour: hours[index], count };
      }
    });
  });
  return best;
}