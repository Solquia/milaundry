/**
 * Copy for the confirmations that guard money and data.
 *
 * Kept out of the screens for two reasons: the wording is the safeguard (a
 * dialog that says "Are you sure?" over "Yes / No" buttons protects nobody),
 * and the same prompt has to read the same way wherever it is raised. Every
 * prompt names its object, names its consequence, and puts the outcome on both
 * buttons instead of Yes / No / OK.
 */
import { changeFor } from './cash-payment';
import { formatMoney } from './money';

export interface ConfirmPrompt {
  title: string;
  message: string;
  /** The destructive or committing choice. */
  confirmLabel: string;
  /** The safe way out. */
  dismissLabel: string;
}

export function cancelOrderPrompt(shortId: string, total: number): ConfirmPrompt {
  return {
    title: `Cancel order ${shortId}?`,
    message: `${formatMoney(total)} will be voided and the order leaves your active list. This cannot be undone.`,
    confirmLabel: 'Cancel order',
    dismissLabel: 'Keep order',
  };
}

export function removeServicePrompt(name: string): ConfirmPrompt {
  return {
    title: `Remove ${name}?`,
    message:
      'It disappears from New Order and your price list. Past orders keep the price they were charged.',
    confirmLabel: 'Remove',
    dismissLabel: 'Keep it',
  };
}

/**
 * The last thing between a tap and a recorded payment. `tendered` is supplied
 * only for cash, where the change owed is the fact the owner needs echoed back
 * before they commit.
 */
export function markPaidPrompt(
  total: number,
  methodLabel: string,
  tendered?: number
): ConfirmPrompt {
  const method = `Recorded as ${methodLabel}.`;
  const message =
    tendered === undefined
      ? method
      : `Received ${formatMoney(tendered)} — ${formatMoney(changeFor(total, tendered).change)} change. ${method}`;

  return {
    title: `Mark ${formatMoney(total)} as paid?`,
    message,
    confirmLabel: 'Mark as paid',
    dismissLabel: 'Not yet',
  };
}

export function signOutPrompt(): ConfirmPrompt {
  return {
    title: 'Sign out?',
    // "login", not "email": shop accounts sign in with a branded username and
    // phone-based sign-ups with their number. Neither has an email.
    message: 'You will need to sign in again with your login and password.',
    confirmLabel: 'Sign out',
    dismissLabel: 'Stay signed in',
  };
}
