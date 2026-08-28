/**
 * Taking the shop's account number away with you.
 *
 * The pay sheet's whole job is to hand over one number, and until now it handed
 * it over to be *read*: set large, in monospace, so a customer could transcribe
 * ten digits into their banking app by eye, switching between two apps and
 * holding four digits in their head at a time. A wrong digit does not bounce —
 * it pays a stranger.
 *
 * What gets displayed and what gets pasted are therefore two different strings.
 * The screen keeps the number exactly as the shop typed it, spaces and all,
 * because that is how the shop's own tarpaulin prints it and how the customer
 * will check it. The clipboard gets the version a bank's field will accept.
 *
 * The wording lives here beside the cleaning because the two have to agree: the
 * button that says "account number" must be confirmed by a line that says
 * "account number copied", or the customer is left wondering which of the
 * shop's three numbers they actually took.
 */
import type { PaymentRail } from './shop-payment';

/**
 * How long the confirmation stands before the control offers the copy again.
 *
 * Long enough to be read after the finger lifts, short enough that a customer
 * coming back to re-copy is not waiting on an animation to finish apologising.
 */
export const COPY_FEEDBACK_MS = 2200;

/**
 * Separators a human puts in a number so another human can read it: grouping
 * whitespace, the hyphen, and the dashes that arrive when a number has been
 * pasted out of a chat message or a word processor.
 */
const SEPARATORS = /[\s‐-―-]+/g;

/**
 * The number as a banking app wants it.
 *
 * Only separators come out. A leading zero is load-bearing on every PH mobile
 * number, and a `+63` prefix is part of the number rather than decoration — so
 * neither is "cleaned" away. A blank number cleans to blank, which is what lets
 * the sheet decline to offer a copy control at all rather than offering one
 * that silently copies nothing.
 */
export function copyableNumber(accountNumber: string): string {
  return (accountNumber ?? '').replace(SEPARATORS, '');
}

/**
 * A wallet has a number; a bank has an account number. Both are true and only
 * one is natural, so the rail decides which it is called.
 */
function numberNoun(rail: PaymentRail): string {
  return rail.method === 'bank_transfer' ? 'account number' : 'number';
}

/**
 * What the copy control announces before it is pressed.
 *
 * The visible label is one word beside an icon, which is all the room there is
 * next to the figure. Assistive technology gets the whole sentence, including
 * the number itself — a customer who cannot see the three rails needs to know
 * which one this button belongs to, and the digits are read as displayed rather
 * than stripped, because grouped digits are the ones a screen reader speaks
 * well.
 */
export function copyPrompt(rail: PaymentRail): string {
  return `Copy ${rail.label} ${numberNoun(rail)} ${rail.accountNumber}`;
}

/**
 * What the sheet says once the number is on the clipboard.
 *
 * Named rather than generic. "Copied" on a screen holding a GCash number, a
 * Maya number and a bank account answers the wrong question.
 */
export function copyConfirmation(rail: PaymentRail): string {
  return `${rail.label} ${numberNoun(rail)} copied`;
}
