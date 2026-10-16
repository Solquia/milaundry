/**
 * Rewards that bring a customer back (migration 0046).
 *
 * An owner runs up to three programs from the Prices tab: a stamp card (every
 * Nth finished visit earns a reward), a welcome gift for a first order, and a
 * regulars' discount once someone has come N times. The customer sees where
 * they stand on the shop's page; the counter applies a reward to an order and
 * the bill drops by it. The database decides who has earned what; this module
 * only words it and mirrors the arithmetic so a screen can preview it.
 */
import { formatMoneyCompact, roundCentavos } from './money';

export type RewardKind = 'stamp_card' | 'welcome' | 'regular';
export type RewardBenefit = 'free' | 'percent' | 'amount';

/**
 * What an order's reward can be: one of the programs, or free laundry the
 * owner or staff gave on their own say-so (0048).
 */
export type OrderRewardKind = RewardKind | 'courtesy';

export const FREE_LAUNDRY_LABEL = 'Free laundry · on the house';

export const REWARD_KINDS: readonly RewardKind[] = ['stamp_card', 'welcome', 'regular'];
const BENEFITS: readonly RewardBenefit[] = ['free', 'percent', 'amount'];

/** A program as an owner keeps it (the `shop_rewards` row). */
export interface ShopReward {
  id: string;
  shop_id: string;
  kind: RewardKind;
  visits_needed: number;
  benefit: RewardBenefit;
  benefit_value: number;
  is_active: boolean;
}

/** A live program and how many of it this customer can use right now. */
export interface RewardProgram {
  id: string;
  kind: RewardKind;
  visits_needed: number;
  benefit: RewardBenefit;
  benefit_value: number;
  ready: number;
}

export interface RewardStanding {
  /** False when the order has neither an account nor a phone to count by. */
  tracked: boolean;
  /** Finished orders at this shop. */
  visits: number;
  programs: RewardProgram[];
}

export interface ShopRewardStanding extends RewardStanding {
  shop_id: string;
  shop_name: string;
}

export const KIND_LABELS: Record<RewardKind, string> = {
  stamp_card: 'Stamp card',
  welcome: 'Welcome gift',
  regular: 'Regulars',
};

export const KIND_BLURBS: Record<RewardKind, string> = {
  stamp_card: 'Every few finished visits earns a reward. The classic "10th wash free".',
  welcome: 'A gift on a customer’s first order, so trying you costs less.',
  regular: 'Once someone has come enough times, every order gets a discount.',
};

export const BENEFIT_OPTIONS: readonly { key: RewardBenefit; label: string }[] = [
  { key: 'free', label: 'Free wash' },
  { key: 'percent', label: '% off' },
  { key: 'amount', label: '₱ off' },
];

/** Sensible starting points, so turning a program on is one tap. */
export const REWARD_DEFAULTS: Record<
  RewardKind,
  { visits_needed: number; benefit: RewardBenefit; benefit_value: number }
> = {
  stamp_card: { visits_needed: 10, benefit: 'free', benefit_value: 150 },
  welcome: { visits_needed: 0, benefit: 'percent', benefit_value: 10 },
  regular: { visits_needed: 20, benefit: 'percent', benefit_value: 5 },
};

export function benefitLabel(benefit: RewardBenefit, value: number): string {
  switch (benefit) {
    case 'free':
      return value > 0 ? `Free wash (up to ${formatMoneyCompact(value)})` : 'Free wash';
    case 'percent':
      return `${value}% off`;
    case 'amount':
      return `${formatMoneyCompact(value)} off`;
  }
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

type ProgramTerms = Pick<RewardProgram, 'kind' | 'visits_needed' | 'benefit' | 'benefit_value'>;

/** One line a customer can take in at a glance: what it asks, what it gives. */
export function programHeadline(program: ProgramTerms): string {
  const gift = benefitLabel(program.benefit, program.benefit_value);
  switch (program.kind) {
    case 'stamp_card':
      return `Every ${ordinal(program.visits_needed)} visit: ${gift}`;
    case 'welcome':
      return `First visit: ${gift}`;
    case 'regular':
      return `After ${program.visits_needed} visits: ${gift} every order`;
  }
}

/** Mirrors `public.reward_amount`: never more than the bill. */
export function rewardAmount(benefit: RewardBenefit, value: number, gross: number): number {
  const bill = Math.max(gross, 0);
  const off =
    benefit === 'free' ? (value > 0 ? value : bill) : benefit === 'percent' ? (bill * value) / 100 : value;
  return roundCentavos(Math.max(0, Math.min(bill, off)));
}

export interface StampProgress {
  /** Stamps to draw filled, out of `visits_needed`. */
  filled: number;
  toGo: number;
  isReady: boolean;
}

/**
 * A full card while a reward waits to be used; a fresh one after. Visits keep
 * counting either way, so the remainder is where the next card stands.
 */
export function stampProgress(visits: number, needed: number, ready: number): StampProgress {
  if (ready > 0) return { filled: needed, toGo: 0, isReady: true };
  const filled = needed > 0 ? visits % needed : 0;
  return { filled, toGo: needed - filled, isReady: false };
}

function visitsWord(n: number): string {
  return n === 1 ? '1 more visit' : `${n} more visits`;
}

/**
 * The one sentence most likely to bring them back: a reward in hand first,
 * then a first-order gift, then the nearest countdown.
 */
export function customerNudge(standing: RewardStanding): string | null {
  const ready = standing.programs.find((p) => p.ready > 0 && p.kind !== 'welcome');
  if (ready) {
    return `Your ${benefitLabel(ready.benefit, ready.benefit_value)} is ready! Show this at the counter.`;
  }
  const welcome = standing.programs.find((p) => p.kind === 'welcome' && p.ready > 0);
  if (welcome) {
    const joiner = welcome.benefit === 'free' ? ' on' : '';
    return `Welcome gift: ${benefitLabel(welcome.benefit, welcome.benefit_value)}${joiner} your first order.`;
  }
  const stamp = standing.programs.find((p) => p.kind === 'stamp_card');
  if (stamp) {
    const { toGo } = stampProgress(standing.visits, stamp.visits_needed, stamp.ready);
    return `${visitsWord(toGo)} to a ${benefitLabel(stamp.benefit, stamp.benefit_value)}.`;
  }
  const regular = standing.programs.find((p) => p.kind === 'regular');
  if (regular) {
    const toGo = Math.max(regular.visits_needed - standing.visits, 0);
    return `${visitsWord(toGo)} to ${benefitLabel(regular.benefit, regular.benefit_value)} every order.`;
  }
  return null;
}

export interface RewardDraft {
  kind: RewardKind;
  visits: string;
  benefit: RewardBenefit;
  value: string;
}

export type DraftResult =
  | { ok: true; value: { visits_needed: number; benefit: RewardBenefit; benefit_value: number } }
  | { ok: false; error: string };

const VISIT_LIMITS: Record<RewardKind, number> = { stamp_card: 50, welcome: 0, regular: 100 };

/** The same limits the database checks, worded for the owner. */
export function validateRewardDraft(draft: RewardDraft): DraftResult {
  let visitsNeeded = 0;
  if (draft.kind !== 'welcome') {
    const max = VISIT_LIMITS[draft.kind];
    const visits = Number(draft.visits.trim());
    if (!Number.isInteger(visits) || visits < 2 || visits > max) {
      return { ok: false, error: `Visits must be a whole number from 2 to ${max}.` };
    }
    visitsNeeded = visits;
  }

  const text = draft.value.trim();
  const value = text === '' ? 0 : Number(text);
  if (!Number.isFinite(value) || value < 0 || value > 100000) {
    return { ok: false, error: 'Enter the amount as a number.' };
  }
  if (draft.benefit === 'percent' && (value < 1 || value > 100)) {
    return { ok: false, error: 'The discount must be from 1% to 100%.' };
  }
  if (draft.benefit === 'amount' && value <= 0) {
    return { ok: false, error: 'Enter how many pesos to take off.' };
  }
  return {
    ok: true,
    value: { visits_needed: visitsNeeded, benefit: draft.benefit, benefit_value: roundCentavos(value) },
  };
}

export interface RewardedOrder {
  reward_kind: OrderRewardKind | null;
  reward_benefit: RewardBenefit | null;
  reward_value: number | null;
  reward_discount: number;
  reward_estimate_discount: number;
  final_total: number | null;
}

/** The reward on an order and what it took off the figure now on screen. */
export function appliedReward(order: RewardedOrder): { label: string; discount: number } | null {
  if (!order.reward_kind || !order.reward_benefit) return null;
  const discount = order.final_total === null ? order.reward_estimate_discount : order.reward_discount;
  if (order.reward_kind === 'courtesy') return { label: FREE_LAUNDRY_LABEL, discount: Number(discount) };
  const gift = benefitLabel(order.reward_benefit, Number(order.reward_value ?? 0));
  return { label: `${KIND_LABELS[order.reward_kind]} · ${gift}`, discount: Number(discount) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseProgram(raw: unknown): RewardProgram | null {
  if (!isRecord(raw)) return null;
  const kind = raw.kind as RewardKind;
  const benefit = raw.benefit as RewardBenefit;
  if (!REWARD_KINDS.includes(kind) || !BENEFITS.includes(benefit) || typeof raw.id !== 'string') {
    return null;
  }
  return {
    id: raw.id,
    kind,
    benefit,
    visits_needed: Number(raw.visits_needed) || 0,
    benefit_value: Number(raw.benefit_value) || 0,
    ready: Number(raw.ready) || 0,
  };
}

/** The jsonb from `reward_standing`, checked rather than trusted. */
export function parseStanding(raw: unknown): RewardStanding {
  if (!isRecord(raw)) return { tracked: false, visits: 0, programs: [] };
  const programs = Array.isArray(raw.programs)
    ? raw.programs.map(parseProgram).filter((p): p is RewardProgram => p !== null)
    : [];
  return { tracked: raw.tracked === true, visits: Number(raw.visits) || 0, programs };
}

export function parseShopStandings(raw: unknown): ShopRewardStanding[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isRecord).map((row) => ({
    ...parseStanding(row),
    shop_id: String(row.shop_id),
    shop_name: String(row.shop_name ?? ''),
  }));
}
