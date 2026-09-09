/**
 * The moment a laundry becomes yours, and how loudly the app says so.
 *
 * Connecting is the one action that turns a shop in a directory into *your*
 * shop — every price on the screen unlocks behind it, and the laundry takes a
 * permanent place, in its own colour, on the home tab. It has always deserved
 * an answer. What it did not deserve was the same answer every time.
 *
 * The first connection is a different event from the fifth. Before it, the app
 * has nowhere to send a load and every screen in it is a preview; after it,
 * MiLaundry is a thing the customer owns. That transition happens exactly once
 * per customer, and it is the only one here allowed to be a celebration. Every
 * connection after it gets the same *gesture* at a smaller amplitude — a
 * confirmation that feels certain rather than congratulatory, because a
 * customer who connects to four laundries should not be applauded four times.
 *
 * The rank, the words, the tap, and the number of rings all live here rather
 * than in the shopfront, because the *proportion* is the design decision and
 * it is the thing that would quietly drift.
 */

import type { HapticIntent } from './haptic-feedback';

export type ConnectionRank =
  /** The customer had no laundry at all until this one. */
  | 'first'
  /** They already had at least one. */
  | 'another';

export interface WelcomeNote {
  rank: ConnectionRank;
  title: string;
  body: string;
}

const FALLBACK_NAME = 'Laundry shop';

/** How far apart the rings of a first-laundry rinse leave the mark. */
export const CLAIM_RING_STEP_MS = 170;

/**
 * Which moment this is, from how many laundries the customer had *before*.
 *
 * Only an exact zero earns the milestone. A count that arrived broken — a
 * failed query, a negative, a fraction — is quietly treated as "another",
 * because congratulating someone on a first laundry they got last month is a
 * worse failure than saying nothing special at all.
 */
export function connectionRank(priorCount: number): ConnectionRank {
  return Number.isInteger(priorCount) && priorCount === 0 ? 'first' : 'another';
}

/**
 * What the shopfront says the instant the connection lands.
 *
 * Both notes lead with the thing that changed, and the milestone lives in the
 * heading rather than in a label above it — a badge reading "Your first
 * laundry" over a heading saying the same thing is the heading admitting it
 * could not carry itself. The first-laundry note spends its second line on what
 * the customer now owns; the later note spends its own on where this shop sits
 * among the ones they already have, which is real information rather than a
 * second round of applause.
 */
export function welcomeNote(shopName: string, priorCount: number): WelcomeNote {
  const name = shopName.trim() || FALLBACK_NAME;
  const rank = connectionRank(priorCount);

  if (rank === 'first') {
    return {
      rank,
      title: `${name} is your first laundry`,
      body:
        'It takes its own colour on your home screen from now on. Pick a service below and book your first load.',
    };
  }

  return {
    rank,
    title: `You're connected to ${name}`,
    body: `Its price list is yours now${companyPhrase(priorCount)}.`,
  };
}

/** The other laundries this one just joined, named only when the count is real. */
function companyPhrase(priorCount: number): string {
  if (!Number.isInteger(priorCount) || priorCount < 1) return '';
  if (priorCount === 1) return ', alongside the one laundry already on your home screen';
  return `, alongside the ${priorCount} laundries already on your home screen`;
}

/**
 * The tap the connection gives back.
 *
 * A commit is what every connection is; the success notification is reserved
 * for the one that changes what the app is for. Spending it on all of them is
 * how a haptic stops carrying meaning.
 */
export function claimHaptic(rank: ConnectionRank): HapticIntent {
  return rank === 'first' ? 'success' : 'commit';
}

/**
 * When each ring of water leaves the shop's mark.
 *
 * One ring is an acknowledgement. Three is a rinse — the same gesture, held
 * long enough to read as an event. Both start at zero, so the finger is
 * answered on the frame it lifts and the extra rings are the celebration, never
 * the delay before one.
 */
export function claimRingDelays(rank: ConnectionRank): number[] {
  if (rank !== 'first') return [0];
  return [0, CLAIM_RING_STEP_MS, CLAIM_RING_STEP_MS * 2];
}

/**
 * The connection a customer carried here from the shops directory.
 *
 * Joining from the directory navigates straight to the shopfront, so the moment
 * would otherwise be lost on the way: the screen that could stage it is not the
 * screen the tap happened on. The prior count rides across as a query param,
 * and `null` simply means no connection just happened — the ordinary case of
 * opening a shop you joined weeks ago.
 */
export function parseWelcomeParam(
  value: string | string[] | undefined
): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string' || raw.trim() === '') return null;

  const count = Number(raw);
  if (!Number.isInteger(count) || count < 0) return null;
  return count;
}
