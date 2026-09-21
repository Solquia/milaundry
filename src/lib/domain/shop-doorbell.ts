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

export interface DoorbellOrder {
  id: string;
  order_type: OrderType;
  status: OrderStatus;
  customer_name: string;
}

export interface DoorbellChime {
  orderId: string;
  title: string;
  body: string;
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
  const nextSeen = new Set(orders.map((order) => order.id));
  if (seen === null || !enabled) return { seen: nextSeen, chimes: [] };

  const chimes: DoorbellChime[] = [];
  for (const order of orders) {
    if (seen.has(order.id)) continue;
    const chime = chimeFor(order);
    if (chime) chimes.push(chime);
  }
  return { seen: nextSeen, chimes };
}

/** One banner even when two bookings land in the same refresh. */
export function doorbellHeadline(chimes: readonly DoorbellChime[]): DoorbellNotice | null {
  if (chimes.length === 0) return null;
  if (chimes.length === 1) return chimes[0];

  const first = chimes[0];
  const others = chimes.length - 1;
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
      ? 'This phone rings when a customer books online.'
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
