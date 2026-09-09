/**
 * How a shop actually gets paid.
 *
 * The app does not move money. A customer who is not standing at the counter
 * pays the shop the way they already would — GCash, Maya, a bank transfer —
 * from inside their own banking app, and the shop confirms it against their own
 * records. What this module produces is the small set of facts that transfer
 * needs: which rails the shop has published, whose name is on the account, and
 * the number to send to.
 *
 * A rail with no number is not offered. Sending someone to a dead end is worse
 * than telling them the shop takes cash.
 */
import type { PaymentMethod } from './walk-in-order';

export interface ShopPaymentDetails {
  gcash_number: string;
  /**
   * The account holder. Shared with Maya rather than duplicated, because in a
   * family-run laundry both wallets belong to the same person, and a second
   * field is a second thing to keep in sync.
   */
  gcash_name: string;
  maya_number: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
}

export interface PaymentRail {
  method: PaymentMethod;
  /** What the customer taps: 'GCash', 'Maya', or the bank's own name. */
  label: string;
  accountName: string;
  accountNumber: string;
  /** Ionicons glyph. */
  icon: string;
}

const clean = (value: string | undefined): string => (value ?? '').trim();

/**
 * Every rail the shop has actually filled in, in a fixed order.
 *
 * The order is hard-coded rather than taken from object keys so the customer's
 * payment screen does not reshuffle between visits — muscle memory is worth
 * more here than any cleverness about ranking.
 */
export function availableRails(
  details: Partial<ShopPaymentDetails>,
  shopName: string
): PaymentRail[] {
  const rails: PaymentRail[] = [];
  // One name covers both wallets; the shop name stands in when it is blank,
  // because a bare number with nobody's name on it is what makes a customer
  // stop before sending money.
  const walletName = clean(details.gcash_name) || shopName;

  const gcash = clean(details.gcash_number);
  if (gcash) {
    rails.push({
      method: 'gcash',
      label: 'GCash',
      accountName: walletName,
      accountNumber: gcash,
      icon: 'phone-portrait-outline',
    });
  }

  const maya = clean(details.maya_number);
  if (maya) {
    rails.push({
      method: 'maya',
      label: 'Maya',
      accountName: walletName,
      accountNumber: maya,
      icon: 'wallet-outline',
    });
  }

  // The account number is the rail. A bank name without one cannot be paid to.
  const account = clean(details.bank_account_number);
  if (account) {
    rails.push({
      method: 'bank_transfer',
      label: clean(details.bank_name) || 'Bank transfer',
      accountName: clean(details.bank_account_name) || shopName,
      accountNumber: account,
      icon: 'business-outline',
    });
  }

  return rails;
}

export function hasOnlineRails(
  details: Partial<ShopPaymentDetails>,
  shopName: string
): boolean {
  return availableRails(details, shopName).length > 0;
}

/**
 * What the customer may choose, cash last.
 *
 * Cash is never configured and never absent — every laundry takes notes across
 * a counter. It sits at the end because a customer on this screen is, by
 * definition, not at the counter.
 */
export function payableMethods(
  details: Partial<ShopPaymentDetails>,
  shopName: string
): PaymentMethod[] {
  return [...availableRails(details, shopName).map((rail) => rail.method), 'cash'];
}

/** The one line above the rails, which differs entirely when there are none. */
export function railsNotice(
  details: Partial<ShopPaymentDetails>,
  shopName: string
): string {
  if (!hasOnlineRails(details, shopName)) {
    return `${shopName} takes cash only. Pay at the counter when you collect your laundry.`;
  }
  return `Send the exact amount, then upload your receipt so ${shopName} can confirm it.`;
}
