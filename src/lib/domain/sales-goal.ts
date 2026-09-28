/**
 * The day's sales target: how far along, how much is left, and whether this
 * is the moment to celebrate. A goal is the owner's own number, so it is read
 * the way they would type it, and the celebration happens once a day.
 */
import { roundCentavos } from './money';

export interface GoalProgress {
  /** 0–1, for the bar. */
  ratio: number;
  /** Whole percent, may pass 100. */
  pct: number;
  remaining: number;
  isHit: boolean;
}

export function parseGoal(text: string): number | null {
  const cleaned = text.replace(/[₱,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Math.round(Number(cleaned));
  return value > 0 ? value : null;
}

export function goalProgress(collected: number, goal: number): GoalProgress {
  const raw = goal <= 0 ? 0 : collected / goal;
  return {
    ratio: Math.min(1, raw),
    pct: Math.round(raw * 100),
    remaining: Math.max(0, roundCentavos(goal - collected)),
    isHit: goal > 0 && collected >= goal,
  };
}

/** Local calendar day, "2026-09-28". */
export function dayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function shouldCelebrate(isHit: boolean, lastCelebrated: string | null, today: string): boolean {
  return isHit && lastCelebrated !== today;
}
export interface PaidOrder {
  status: string;
  payment_status: string;
  paid_at: string | null;
  estimated_total: number;
  final_total: number | null;
}

/** Sales for each of the last `days` finished days, oldest first; today is left out. */
export function dailyTotals(orders: readonly PaidOrder[], now: Date, days: number): number[] {
  const totals = Array.from({ length: days }, () => 0);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const order of orders) {
    if (order.status === 'cancelled' || order.payment_status !== 'paid' || !order.paid_at) continue;
    const paid = new Date(order.paid_at);
    const day = new Date(paid.getFullYear(), paid.getMonth(), paid.getDate());
    const back = Math.round((todayStart.getTime() - day.getTime()) / 86_400_000);
    if (back >= 1 && back <= days) totals[days - back] += order.final_total ?? order.estimated_total;
  }
  return totals.map(roundCentavos);
}

const STEP = 500;
const STARTER_GOALS = [3000, 5000, 8000];
const roundUp = (value: number): number => Math.ceil(value / STEP) * STEP;

/** The usual day, a stretch, and a big day, from the days the shop actually took money. */
export function suggestGoals(totals: readonly number[]): number[] {
  const active = totals.filter((total) => total > 0);
  if (active.length === 0) return [...STARTER_GOALS];
  const usual = active.reduce((sum, total) => sum + total, 0) / active.length;
  return [...new Set([roundUp(usual), roundUp(usual * 1.2), roundUp(usual * 1.5)])];
}
