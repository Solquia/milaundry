/**
 * What the owner should do next, read off every figure on Sales: money
 * waiting at the counter, shelves running empty, supplies or spending eating
 * the takings, a slow day, costs not set. Each step says what to do and opens
 * the screen to do it, so the numbers lead somewhere instead of just sitting.
 *
 * Most urgent first, and never more than a handful: a list of twelve chores
 * is a report, not a next step.
 */
import { formatMoney } from './money';

/** Supplies above this share of sales are worth a look at the recipes. */
export const SUPPLY_SHARE_WARN = 0.15;
/** Spending above this share of money in is worth a look. */
export const EXPENSE_SHARE_WARN = 0.5;
export const MAX_ACTIONS = 5;

export type ActionTone = 'urgent' | 'warn' | 'tip' | 'good';
export type ActionTarget = 'collect' | 'prices' | 'expenses' | 'analytics';

export interface OwnerAction {
  key: string;
  tone: ActionTone;
  title: string;
  detail: string;
  target: ActionTarget | null;
}

export interface ActionInput {
  /** Orders taken in the period, what they sold for. */
  sold: number;
  moneyIn: number;
  supplies: number;
  taken: number;
  /** Ready or overdue and unpaid: money that can be collected now. */
  collectable: { amount: number; count: number };
  /** Counted add-ons out or low, out first. */
  restock: readonly { name: string; left: number | null }[];
  topSupply: { name: string; cost: number } | null;
  expenses: { total: number; top: { label: string; amount: number } | null };
  salesDelta: number;
  compareLabel: string;
  /** Add-ons and orders whose cost is not set. */
  missingCosts: number;
}

const RANK: Record<ActionTone, number> = { urgent: 0, warn: 1, tip: 2, good: 3 };
const percent = (part: number, whole: number) => Math.round((part / whole) * 100);
const customers = (count: number) => `${count} ${count === 1 ? 'customer' : 'customers'}`;

export function ownerActions(input: ActionInput): OwnerAction[] {
  const actions: OwnerAction[] = [
    ...collectAction(input),
    ...restockActions(input),
    ...expenseAction(input),
    ...supplyAction(input),
    ...paceAction(input),
    ...costsAction(input),
  ];
  if (actions.length === 0) {
    return [
      {
        key: 'clear',
        tone: 'good',
        title: 'All caught up',
        detail: 'Nothing to collect, nothing running out, costs in line.',
        target: null,
      },
    ];
  }
  // A stable sort keeps each tone's own order: out before low, and so on.
  return actions.sort((a, b) => RANK[a.tone] - RANK[b.tone]).slice(0, MAX_ACTIONS);
}

function collectAction({ collectable }: ActionInput): OwnerAction[] {
  if (collectable.amount <= 0) return [];
  return [
    {
      key: 'collect',
      tone: 'urgent',
      title: `Collect ${formatMoney(collectable.amount)} from ${customers(collectable.count)}`,
      detail: 'Their laundry is ready but not paid. Send a reminder or collect at pickup.',
      target: 'collect',
    },
  ];
}

function restockActions({ restock }: ActionInput): OwnerAction[] {
  return restock.map((item): OwnerAction => {
    const isOut = (item.left ?? 0) <= 0;
    return {
      key: `restock-${item.name}`,
      tone: isOut ? 'urgent' : 'warn',
      title: isOut ? `Restock ${item.name}: it is out` : `Buy more ${item.name}: ${item.left} left`,
      detail: isOut
        ? 'Customers cannot pick it until it is back on the shelf.'
        : 'Top it up before it runs out, then update the count in Prices.',
      target: 'prices',
    };
  });
}

function expenseAction({ expenses, moneyIn }: ActionInput): OwnerAction[] {
  if (expenses.total <= 0) return [];
  const biggest = expenses.top ? ` Biggest: ${expenses.top.label} ${formatMoney(expenses.top.amount)}.` : '';
  if (expenses.total > moneyIn) {
    return [
      {
        key: 'expenses',
        tone: 'urgent',
        title: `Spent ${formatMoney(expenses.total)}, more than came in`,
        detail: `Money in was ${formatMoney(moneyIn)}.${biggest}`,
        target: 'expenses',
      },
    ];
  }
  if (expenses.total > moneyIn * EXPENSE_SHARE_WARN) {
    return [
      {
        key: 'expenses',
        tone: 'warn',
        title: `Spending is ${percent(expenses.total, moneyIn)}% of money in`,
        detail: `Check whether every expense was needed.${biggest}`,
        target: 'expenses',
      },
    ];
  }
  return [];
}

function supplyAction({ supplies, sold, topSupply }: ActionInput): OwnerAction[] {
  if (sold <= 0 || supplies <= 0 || supplies / sold <= SUPPLY_SHARE_WARN) return [];
  const biggest = topSupply ? ` ${topSupply.name} cost the most (${formatMoney(topSupply.cost)}).` : '';
  return [
    {
      key: 'supplies',
      tone: 'warn',
      title: `Supplies took ${percent(supplies, sold)}% of sales`,
      detail: `Check how much each load gets, or raise prices.${biggest}`,
      target: 'prices',
    },
  ];
}

function paceAction({ salesDelta, compareLabel }: ActionInput): OwnerAction[] {
  if (salesDelta >= 0) return [];
  return [
    {
      key: 'pace',
      tone: 'tip',
      title: `Money in is ${formatMoney(Math.abs(salesDelta))} behind ${compareLabel}`,
      detail: 'Open full analytics to see your busiest hours and best sellers.',
      target: 'analytics',
    },
  ];
}

function costsAction({ missingCosts }: ActionInput): OwnerAction[] {
  if (missingCosts <= 0) return [];
  return [
    {
      key: 'costs',
      tone: 'tip',
      title: `Set ${missingCosts} missing ${missingCosts === 1 ? 'cost' : 'costs'}`,
      detail: 'Profit and supplies used are only exact once every cost is entered.',
      target: 'prices',
    },
  ];
}
