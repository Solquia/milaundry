/**
 * The shop's doorbell: a customer booked, and the counter should hear it.
 *
 * The order list already grows on a timer. A list that updates in silence is
 * how a load sits at `pending` until someone happens to look. This module
 * decides *whether* to ring and *what* to say; the phone, the banner, and the
 * test button live elsewhere, so the rule can be tested without a speaker.
 *
 * Walk-ins stay quiet: the person who typed them is already at the till.
 * The first snapshot stays quiet too: those orders were already in the shop
 * when the app opened, they are not arriving now.
 */

import type { OrderStatus } from './order-status';
import type { OrderType } from './order-tags';
import { PAYMENT_LABELS } from './payment-summary';
import type { Fulfillment, PaymentMethod } from './walk-in-order';

export interface DoorbellOrder {
  id: string;
  order_type: OrderType;
  status: OrderStatus;
  customer_name: string;
  /** The payment news the bell also rings for, once the order is known. */
  payment_method?: PaymentMethod;
  fulfillment?: Fulfillment;
  payment_choice_sent_at?: string | null;
  payment_proof_path?: string | null;
}

export interface DoorbellChime {
  orderId: string;
  title: string;
  body: string;
  /** A booking unless it is payment news. */
  kind?: 'payment';
}

export interface DoorbellNotice {
  orderId: string;
  title: string;
  body: string;
}

export interface DoorbellChannels {
  playSound: boolean;
  haptic: boolean;
  banner: boolean;
  /** A system notice when the app is not on screen. */
  systemNotice: boolean;
}

export interface DoorbellCardCopy {
  title: string;
  caption: string;
  testLabel: string;
  testCaption: string;
  /** Shown after the test button, so a silent phone still confirms the tap. */
  rangCaption: string;
}

export interface DoorbellBannerCopy {
  orderId: string;
  title: string;
  body: string;
  actionLabel: string;
}

const DEFAULT_ENABLED = true;

/** Never throws: unreadable storage means the shop still rings. */
export function parseDoorbellEnabled(raw: string | null | undefined): boolean {
  if (raw == null) return DEFAULT_ENABLED;
  if (raw === 'false') return false;
  if (raw === 'true') return true;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'boolean' ? parsed : DEFAULT_ENABLED;
  } catch {
    return DEFAULT_ENABLED;
  }
}

function guestName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : 'Someone';
}

function chimeFor(order: DoorbellOrder): DoorbellChime | null {
  if (order.order_type !== 'online') return null;
  if (order.status === 'cancelled') return null;
  return {
    orderId: order.id,
    title: 'New order',
    body: `${guestName(order.customer_name)} booked online.`,
  };
}

/**
 * The customer telling the shop how they are paying: a cash choice sent from
 * the pay card, or a receipt uploaded. Each keyed by its own stamp, so sending
 * again rings again and a refresh does not.
 */
function paymentNews(order: DoorbellOrder): { key: string; chime: DoorbellChime }[] {
  if (order.order_type !== 'online' || order.status === 'cancelled') return [];
  const name = guestName(order.customer_name);
  const news: { key: string; chime: DoorbellChime }[] = [];
  if (order.payment_proof_path) {
    const method = order.payment_method ? PAYMENT_LABELS[order.payment_method] : 'payment';
    news.push({
      key: `proof:${order.id}:${order.payment_proof_path}`,
      chime: {
        orderId: order.id,
        title: 'Payment sent',
        body: `${name} sent a ${method} receipt. Check it and confirm.`,
        kind: 'payment',
      },
    });
  }
  if (order.payment_choice_sent_at && order.payment_method === 'cash') {
    const when = order.fulfillment === 'delivery' ? 'on delivery' : 'at pickup';
    news.push({
      key: `choice:${order.id}:${order.payment_choice_sent_at}`,
      chime: {
        orderId: order.id,
        title: 'Paying in cash',
        body: `${name} will pay cash ${when}.`,
        kind: 'payment',
      },
    });
  }
  return news;
}

/**
 * What just arrived, and the ids the next look should treat as already seen.
 *
 * `seen === null` is the first look after opening the shop: seed the set,
 * ring nothing. Turning the bell off still advances `seen`, so switching it
 * back on later does not dump a backlog of rings.
 */
export function nextDoorbell(
  seen: ReadonlySet<string> | null,
  orders: readonly DoorbellOrder[],
  enabled: boolean
): { seen: Set<string>; chimes: DoorbellChime[] } {
  const nextSeen = new Set<string>();
  for (const order of orders) {
    nextSeen.add(order.id);
    for (const news of paymentNews(order)) nextSeen.add(news.key);
  }
  if (seen === null || !enabled) return { seen: nextSeen, chimes: [] };

  const chimes: DoorbellChime[] = [];
  for (const order of orders) {
    if (!seen.has(order.id)) {
      // A brand-new order rings as a booking; its payment is news for later.
      const chime = chimeFor(order);
      if (chime) chimes.push(chime);
      continue;
    }
    for (const news of paymentNews(order)) {
      if (!seen.has(news.key)) chimes.push(news.chime);
    }
  }
  return { seen: nextSeen, chimes };
}

/** One banner even when two bookings land in the same refresh. */
export function doorbellHeadline(chimes: readonly DoorbellChime[]): DoorbellNotice | null {
  if (chimes.length === 0) return null;
  if (chimes.length === 1) return chimes[0];

  const first = chimes[0];
  const others = chimes.length - 1;
  if (chimes.some((chime) => chime.kind === 'payment')) {
    return {
      orderId: first.orderId,
      title: `${chimes.length} order updates`,
      body: `${first.body} And ${others} more.`,
    };
  }
  const who = guestName(first.body.replace(/ booked online\.$/, ''));
  return {
    orderId: first.orderId,
    title: `${chimes.length} new orders`,
    body: `${who} and ${others} other${others === 1 ? '' : 's'} booked online.`,
  };
}

export function doorbellChannels(appVisible: boolean): DoorbellChannels {
  return {
    playSound: true,
    haptic: true,
    banner: true,
    systemNotice: !appVisible,
  };
}

/** A ring the shop can hear without a customer placing an order. */
export function testDoorbellChime(): DoorbellChime {
  return {
    orderId: 'test',
    title: 'Test ring',
    body: 'This is what a new order sounds like.',
  };
}

export function doorbellCard(enabled: boolean): DoorbellCardCopy {
  return {
    title: 'New-order bell',
    caption: enabled
      ? 'This phone rings when a customer books online or sends a payment.'
      : 'The shop stays quiet. New orders still appear in the list.',
    testLabel: 'Ring the shop',
    testCaption: 'Hear it now, without waiting for a customer.',
    rangCaption: 'Rang. If you did not hear it, turn the volume up.',
  };
}

export function doorbellBanner(notice: DoorbellNotice): DoorbellBannerCopy {
  return {
    ...notice,
    actionLabel: 'Open',
  };
}
