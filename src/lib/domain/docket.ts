/**
 * The number on the docket.
 *
 * A laundry order already has a physical twin: the paper slip the shop staples
 * to the bag. That slip always carries a short number, because the thing it is
 * for is being read aloud across a counter — "I'm here for F6A7B8" — and a
 * 36-character uuid cannot be read aloud by anyone.
 *
 * So this is decoration that turned out to be the useful part. It is the tail
 * of the id rather than the head: uuids generated moments apart on the same
 * device can share a prefix, and two dockets on one counter that read the same
 * would be worse than no number at all.
 */

import type { BillStage } from './actual-bill';

/** Six characters: short enough to say, long enough not to collide by eye. */
export const DOCKET_LENGTH = 6;

/**
 * The mark struck across the ticket, or null when there is nothing to strike.
 *
 * A stamp means somebody with authority marked this docket. An estimate has no
 * authority behind it — the load has not been on the scale, and nobody has
 * agreed to the number — so it gets no stamp at all. That makes the stamp's
 * *arrival* the information: the ticket is unmarked while the price is still a
 * guess, and carries a mark the moment the shop stands behind it.
 */
export function stampLabel(stage: BillStage): string | null {
  switch (stage) {
    case 'weighed':
      return 'TO PAY';
    case 'settled':
      return 'PAID';
    default:
      return null;
  }
}

export function docketNumber(id: string | null | undefined): string {
  if (!id) return '';

  // Dashes are the uuid's own punctuation, not part of the number. A slip that
  // prints "NO. 5F6-A7B" invites someone to read the dash out.
  const characters = id.replace(/[^a-zA-Z0-9]/g, '');
  if (!characters) return '';

  return characters.slice(-DOCKET_LENGTH).toUpperCase();
}
