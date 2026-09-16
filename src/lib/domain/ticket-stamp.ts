/**
 * The stamp on a ticket, and the card that says who the ticket belongs to.
 *
 * A laundry ticket is not illustrated; it is *stamped*. The counter takes the
 * load, inks a chop with the day it came in, and hands the stub back. That
 * mark is the one thing on a stub nobody has to be taught to read, and it
 * carries a fact the rest of the stub does not: when this started.
 *
 * The month names are spelled here rather than left to the device locale, for
 * the same reason `order-time.ts` spells its own — a chop that reads SEP on
 * one phone and SET on another is not a chop, and a test cannot pin it.
 */

const CHOP_MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

const FULL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export interface Chop {
  /** 'SEP' — the upper wheel. */
  month: string;
  /** '15' — always two figures, because a chop sets both wheels. */
  day: string;
  year: string;
}

function parsed(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The date as a chop sets it, or null when there is nothing to stamp.
 *
 * Null rather than a fallback date: a stub with no stamp reads as a ticket
 * whose chop did not take, which is honest. A stub stamped with today's date
 * because the real one could not be read is a lie printed in ink.
 */
export function chopDate(iso: string | null | undefined): Chop | null {
  const date = parsed(iso);
  if (!date) return null;

  return {
    month: CHOP_MONTHS[date.getMonth()],
    day: String(date.getDate()).padStart(2, '0'),
    year: String(date.getFullYear()),
  };
}

/**
 * The letters on the disc where a photograph would be.
 *
 * First and last, never the middle: "AMRC" is a monogram on a towel, not an
 * avatar. A nameless account gets a question mark, which reads as a person
 * whose name we do not have rather than as an empty circle.
 */
export function profileInitials(fullName: string | null | undefined): string {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "September 2026", or nothing at all when the date cannot be read. */
export function memberSince(iso: string | null | undefined): string {
  const date = parsed(iso);
  if (!date) return '';
  return `${FULL_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export interface ProfileFacts {
  shopCount: number;
  orderCount: number;
  createdAt: string | null | undefined;
}

function countLabel(count: number, one: string, many: string, none: string): string {
  if (count <= 0) return none;
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * The one line under a customer's name: what they have with us, and how long
 * they have had it. Every figure is one the app already knows — nothing here
 * is a badge, a tier, or a percentage of a profile nobody asked them to fill.
 */
export function profileFacts({ shopCount, orderCount, createdAt }: ProfileFacts): string {
  const since = memberSince(createdAt);
  const parts = [
    countLabel(shopCount, 'shop', 'shops', 'No shops yet'),
    countLabel(orderCount, 'load', 'loads', 'no loads yet'),
  ];
  if (since) parts.push(`since ${since}`);
  return parts.join(' · ');
}
