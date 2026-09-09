/**
 * Who holds an order: the account behind it, if any, and how it got there.
 *
 * A walk-in ticket starts with nobody attached. When the customer scans the
 * ticket's QR, `claim_order` hands it to their account and stamps `claimed_at`,
 * and from that moment the shop should be able to see that it happened and
 * who now holds the ticket. The counter used to see nothing: the row looked
 * exactly as it did before the scan. An online booking is held by its booker
 * from the first second, so it is the same fact arrived at a different way.
 *
 * The name comes from the shop's customer list rather than from the ticket,
 * because the ticket carries whatever the counter typed ("Maria") and the
 * account carries the person's own name ("Maria Soledad Cruz"). Both are
 * true; the profile is the one that opens their history.
 */
import { formatOrderTime } from './order-card';
import type { OrderType } from './order-tags';
import { searchDigits } from './phone';

export interface HeldOrder {
  order_type: OrderType;
  customer_id: string | null;
  claimed_at: string | null;
  customer_phone: string;
}

/** One row of `get_shop_customers` — the shape the customer book already loads. */
export interface HolderAccount {
  customer_id: string;
  full_name: string;
  phone: string;
}

export type OrderHolder =
  | { kind: 'walk_in' }
  | { kind: 'claimed'; customerId: string; claimedAt: string | null }
  | { kind: 'booked'; customerId: string };

export function orderHolder(order: HeldOrder): OrderHolder {
  if (!order.customer_id) return { kind: 'walk_in' };
  if (order.order_type === 'online') return { kind: 'booked', customerId: order.customer_id };
  return { kind: 'claimed', customerId: order.customer_id, claimedAt: order.claimed_at };
}

/** The key the customer book files this person under, or null for nobody. */
export function holderBookKey(holder: OrderHolder): string | null {
  return holder.kind === 'walk_in' ? null : `acct:${holder.customerId}`;
}

export function findHolderAccount(
  order: HeldOrder,
  accounts: readonly HolderAccount[]
): HolderAccount | null {
  if (!order.customer_id) return null;
  return accounts.find((account) => account.customer_id === order.customer_id) ?? null;
}

export interface HolderSummary {
  /** The account's own name, or a stand-in when it is not to hand. */
  name: string;
  isNamed: boolean;
  /** `Claimed this ticket 10:15 AM · has the app` / `Booked in the app`. */
  detail: string;
  /** The account's number when the ticket carries a different one, else null. */
  otherPhone: string | null;
}

const STAND_IN_NAME = 'App customer';

/** Null for an unclaimed walk-in: there is nobody to summarise. */
export function holderSummary(
  order: HeldOrder,
  account: HolderAccount | null,
  now: Date
): HolderSummary | null {
  const holder = orderHolder(order);
  if (holder.kind === 'walk_in') return null;

  const name = account?.full_name.trim() ?? '';
  return {
    name: name || STAND_IN_NAME,
    isNamed: name.length > 0,
    detail: holderDetail(holder, now),
    otherPhone: otherPhone(order, account),
  };
}

function holderDetail(holder: Exclude<OrderHolder, { kind: 'walk_in' }>, now: Date): string {
  if (holder.kind === 'booked') return 'Booked in the app';
  const when = holder.claimedAt ? ` ${formatOrderTime(holder.claimedAt, now)}` : '';
  return `Claimed this ticket${when} · has the app`;
}

function otherPhone(order: HeldOrder, account: HolderAccount | null): string | null {
  const phone = account?.phone.trim() ?? '';
  if (!phone) return null;
  return searchDigits(phone) === searchDigits(order.customer_phone) ? null : phone;
}
