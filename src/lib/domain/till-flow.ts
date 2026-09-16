/**
 * The walk-in till, read as a flow rather than as a form.
 *
 * A customer booking on the shop's web page is walked through named questions —
 * "What are we washing?", "When and where?", "Who is this for?" — with a rail
 * counting them off and the running total pinned under the thumb. The counter
 * was asking the same questions with none of that scaffolding: an unnamed
 * second screen reached by a text link, and a button that carried the price.
 *
 * The same two questions, named. Two steps rather than the web's three, because
 * a walk-in has no schedule to set: the laundry is already on the counter.
 *
 * The words live here, beside the words the booking flow uses, so the counter
 * and the storefront cannot drift into asking the same thing differently.
 */
import { ticketCountLabel } from './pos-ticket';
import type { StepSpec } from './step-rail';
import type { Fulfillment } from './walk-in-order';

export type TillStep = 'items' | 'checkout';

/** The two questions, in the order a counter asks them. */
export const TILL_STEPS = [
  { key: 'items', label: 'Items' },
  { key: 'checkout', label: 'Checkout' },
] as const satisfies readonly StepSpec<TillStep>[];

const TITLES: Record<TillStep, string> = {
  items: 'What came in?',
  checkout: 'Who is it for?',
};

/** The question the band asks, in the customer's own words rather than a noun. */
export function tillStepTitle(step: TillStep): string {
  return TITLES[step] ?? TITLES.items;
}

/**
 * The line beside the running total.
 *
 * An empty ticket says so instead of labelling ₱0 an estimate — a figure named
 * "estimate" before anything is on the ticket reads as a price that was quoted.
 */
export function tillEstimateLabel(count: number): string {
  if (count <= 0) return ticketCountLabel(0);
  return `${ticketCountLabel(count)} · estimate`;
}

/**
 * The button that moves the flow on. The total sits above it in its own row,
 * the way the booking footer carries it, so the button names only the action.
 */
export function tillCta(step: TillStep, isSaving: boolean): string {
  if (step === 'items') return 'Continue';
  return isSaving ? 'Saving…' : 'Save order';
}

/**
 * The slip a saved walk-in prints to the screen says "Order saved", where the
 * customer's own slip says "Thank you!". The counter did the saving and the
 * customer is standing in front of it; thanking them from the till reads as
 * the shop talking to itself.
 */
export function savedSlipTitle(): string {
  return 'Order saved';
}

/** What happens to the laundry next — the one thing fulfillment changes. */
export function savedSlipNote(fulfillment: Fulfillment): string {
  return fulfillment === 'delivery'
    ? 'It goes back out to them when it is done.'
    : 'They collect it here once it is ready.';
}

/** What the code on the slip is for, said to whoever is holding the screen. */
export function savedScanNote(): string {
  return 'They scan this to follow the order';
}
