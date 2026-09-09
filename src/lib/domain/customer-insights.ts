/**
 * The customer book: every person who has brought laundry here, rolled up
 * from their orders.
 *
 * The Customers tab used to list only people who had scanned the shop's QR —
 * the minority. A neighbourhood laundry's regulars are walk-ins, and the
 * counter already types their name and number on every ticket. So identity
 * comes from the order itself: the account when there is one, otherwise the
 * phone number, otherwise the name. Lifetime value is what the shop has
 * billed them across every order that was not cancelled, paid or not; what
 * they still owe is kept beside it so the two never get confused.
 */
import type { ShopCustomer } from '../types';
import { roundCentavos } from './money';
import type { OrderStatus } from './order-status';
import type { OrderType, PaymentStatus } from './order-tags';
import { searchDigits } from './phone';

export interface CustomerOrder {
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  estimated_total: number;
  final_total: number | null;
  created_at: string;
  order_type: OrderType;
}

export type Standing = 'connected' | 'new' | 'returning' | 'regular' | 'lapsed';

export const STANDING_LABELS: Record<Standing, string> = {
  connected: 'Connected, no orders yet',
  new: 'New',
  returning: 'Came back',
  regular: 'Regular',
  lapsed: 'Not seen lately',
};

export interface CustomerInsight {
  key: string;
  /**
   * Every key an order of theirs can carry: the account, plus the phone the
   * counter typed on walk-ins before they had the app. Files a person's whole
   * history in one place once they scan a ticket.
   */
  keys: readonly string[];
  name: string;
  phone: string | null;
  /** Has an account connected to this shop. */
  isRegistered: boolean;
  orderCount: number;
  /** Everything billed to them, paid or not, cancelled orders excluded. */
  lifetimeValue: number;
  paidValue: number;
  owed: number;
  averageOrder: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  standing: Standing;
}

export interface CustomerBookSummary {
  /** Everyone in the book, including connected accounts with no orders. */
  total: number;
  /** People with at least one order. */
  ordering: number;
  /** Share of ordering customers who came back at least once, whole percent. */
  repeatRate: number;
  /** Mean lifetime value across ordering customers. */
  averageLifetimeValue: number;
  lapsed: number;
  /** First order within the last thirty days. */
  newThisMonth: number;
}

export interface CustomerBook {
  customers: CustomerInsight[];
  /** Orders with no name, phone or account — counted, never listed. */
  anonymousOrders: number;
  summary: CustomerBookSummary;
}

const DAY = 86_400_000;
/** After this long without an order a customer is worth a follow-up. */
export const LAPSED_AFTER_DAYS = 45;
const NEW_WITHIN_DAYS = 30;
const REGULAR_FROM_ORDERS = 3;

const FALLBACK_NAME = 'Unnamed customer';

// The counter types 0917…, the account stores +63 917…: one number, one person.
const digits = (value: string): string => searchDigits(value);

/** A stable identity for the person behind an order, or null for nobody. */
export function customerKey(order: {
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
}): string | null {
  if (order.customer_id) return `acct:${order.customer_id}`;
  const phone = digits(order.customer_phone);
  if (phone) return `tel:${phone}`;
  const name = order.customer_name.trim().toLowerCase();
  if (name) return `name:${name}`;
  return null;
}

/** `MS` for Maria Soledad, `A` for Ana, `?` for nobody. */
export function customerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}

interface Draft {
  key: string;
  keys: readonly string[];
  name: string;
  phone: string;
  isRegistered: boolean;
  orderCount: number;
  lifetimeValue: number;
  paidValue: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
}

const orderValue = (order: CustomerOrder): number => order.final_total ?? order.estimated_total;

function standingFor(draft: Draft, now: Date): Standing {
  if (draft.orderCount === 0) return 'connected';
  const sinceLast = now.getTime() - new Date(draft.lastOrderAt!).getTime();
  if (sinceLast > LAPSED_AFTER_DAYS * DAY) return 'lapsed';
  if (draft.orderCount >= REGULAR_FROM_ORDERS) return 'regular';
  if (draft.orderCount === 2) return 'returning';
  return 'new';
}

export function buildCustomerBook(
  orders: readonly CustomerOrder[],
  registered: readonly ShopCustomer[],
  now: Date
): CustomerBook {
  const drafts = new Map<string, Draft>();
  // A walk-in keyed by phone folds into the account that owns that number.
  const aliases = new Map<string, string>();
  let anonymousOrders = 0;

  for (const account of registered) {
    const key = `acct:${account.customer_id}`;
    const phone = digits(account.phone);
    const keys = phone ? [key, `tel:${phone}`] : [key];
    if (phone) aliases.set(`tel:${phone}`, key);
    drafts.set(key, {
      key,
      keys,
      name: account.full_name.trim(),
      phone: account.phone.trim(),
      isRegistered: true,
      orderCount: 0,
      lifetimeValue: 0,
      paidValue: 0,
      firstOrderAt: null,
      lastOrderAt: null,
    });
  }

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const own = customerKey(order);
    if (own === null) {
      anonymousOrders += 1;
      continue;
    }
    const key = aliases.get(own) ?? own;
    const current = drafts.get(key) ?? {
      key,
      keys: [key],
      name: '',
      phone: '',
      isRegistered: false,
      orderCount: 0,
      lifetimeValue: 0,
      paidValue: 0,
      firstOrderAt: null,
      lastOrderAt: null,
    };
    drafts.set(key, absorb(current, order));
  }

  const customers = [...drafts.values()].map((draft) => finish(draft, now));
  return { customers, anonymousOrders, summary: summarise(customers, now) };
}

/** Fold one order into a draft, keeping the newest name and number given. */
function absorb(draft: Draft, order: CustomerOrder): Draft {
  const value = orderValue(order);
  const isNewest = draft.lastOrderAt === null || order.created_at > draft.lastOrderAt;
  const isOldest = draft.firstOrderAt === null || order.created_at < draft.firstOrderAt;
  const name = order.customer_name.trim();
  const phone = order.customer_phone.trim();
  return {
    ...draft,
    name: isNewest && name ? name : draft.name || name,
    phone: isNewest && phone ? phone : draft.phone || phone,
    orderCount: draft.orderCount + 1,
    lifetimeValue: draft.lifetimeValue + value,
    paidValue: draft.paidValue + (order.payment_status === 'paid' ? value : 0),
    firstOrderAt: isOldest ? order.created_at : draft.firstOrderAt,
    lastOrderAt: isNewest ? order.created_at : draft.lastOrderAt,
  };
}

function finish(draft: Draft, now: Date): CustomerInsight {
  const lifetimeValue = roundCentavos(draft.lifetimeValue);
  const paidValue = roundCentavos(draft.paidValue);
  return {
    key: draft.key,
    keys: draft.keys,
    name: draft.name || FALLBACK_NAME,
    phone: draft.phone || null,
    isRegistered: draft.isRegistered,
    orderCount: draft.orderCount,
    lifetimeValue,
    paidValue,
    owed: roundCentavos(lifetimeValue - paidValue),
    averageOrder: draft.orderCount === 0 ? 0 : roundCentavos(lifetimeValue / draft.orderCount),
    firstOrderAt: draft.firstOrderAt,
    lastOrderAt: draft.lastOrderAt,
    standing: standingFor(draft, now),
  };
}

function summarise(customers: readonly CustomerInsight[], now: Date): CustomerBookSummary {
  const ordering = customers.filter((customer) => customer.orderCount > 0);
  const repeaters = ordering.filter((customer) => customer.orderCount >= 2);
  const newCutoff = now.getTime() - NEW_WITHIN_DAYS * DAY;
  return {
    total: customers.length,
    ordering: ordering.length,
    repeatRate:
      ordering.length === 0 ? 0 : Math.round((repeaters.length / ordering.length) * 100),
    averageLifetimeValue:
      ordering.length === 0
        ? 0
        : roundCentavos(
            ordering.reduce((sum, customer) => sum + customer.lifetimeValue, 0) / ordering.length
          ),
    lapsed: customers.filter((customer) => customer.standing === 'lapsed').length,
    newThisMonth: ordering.filter(
      (customer) => new Date(customer.firstOrderAt!).getTime() >= newCutoff
    ).length,
  };
}

/**
 * Every order that belongs to this person, cancelled ones included — the
 * profile is a history, not a bill. Keeps the order given.
 */
export function ordersOfCustomer<T extends Parameters<typeof customerKey>[0]>(
  customer: Pick<CustomerInsight, 'keys'>,
  orders: readonly T[]
): T[] {
  return orders.filter((order) => {
    const key = customerKey(order);
    return key !== null && customer.keys.includes(key);
  });
}

// ── sorting and filtering ──────────────────────────────────────────────────

export type CustomerSort = 'value' | 'recent' | 'orders';

export const CUSTOMER_SORTS: readonly { key: CustomerSort; label: string }[] = [
  { key: 'value', label: 'Top spenders' },
  { key: 'recent', label: 'Most recent' },
  { key: 'orders', label: 'Most visits' },
];

const time = (iso: string | null): number => (iso ? new Date(iso).getTime() : 0);

/** A new array; the book itself is never reordered. */
export function sortCustomers(
  customers: readonly CustomerInsight[],
  sort: CustomerSort
): CustomerInsight[] {
  const byValue = (a: CustomerInsight, b: CustomerInsight) => b.lifetimeValue - a.lifetimeValue;
  return [...customers].sort((a, b) => {
    switch (sort) {
      case 'value':
        return byValue(a, b) || b.orderCount - a.orderCount;
      case 'recent':
        return time(b.lastOrderAt) - time(a.lastOrderAt) || byValue(a, b);
      case 'orders':
        return b.orderCount - a.orderCount || byValue(a, b);
    }
  });
}

export type CustomerSegment = 'all' | 'new' | 'regular' | 'owing' | 'lapsed';

export const CUSTOMER_SEGMENTS: readonly { key: CustomerSegment; label: string }[] = [
  { key: 'all', label: 'Everyone' },
  { key: 'new', label: 'New' },
  { key: 'regular', label: 'Regulars' },
  { key: 'owing', label: 'Owe money' },
  { key: 'lapsed', label: 'Not seen lately' },
];

function inSegment(customer: CustomerInsight, segment: CustomerSegment): boolean {
  switch (segment) {
    case 'all':
      return true;
    case 'owing':
      return customer.owed > 0;
    case 'new':
    case 'regular':
    case 'lapsed':
      return customer.standing === segment;
  }
}

function matchesCustomer(customer: CustomerInsight, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  if (customer.name.toLowerCase().includes(needle)) return true;
  const wanted = searchDigits(needle);
  return (
    wanted.length > 0 && customer.phone !== null && searchDigits(customer.phone).includes(wanted)
  );
}

export function filterCustomers(
  customers: readonly CustomerInsight[],
  segment: CustomerSegment,
  query: string
): CustomerInsight[] {
  return customers.filter(
    (customer) => inSegment(customer, segment) && matchesCustomer(customer, query)
  );
}
