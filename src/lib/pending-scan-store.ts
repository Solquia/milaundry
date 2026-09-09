/**
 * The scan a guest made before they had a session.
 *
 * Module state, not storage, for the same reason the splash flag is: a scan
 * belongs to the visit that made it. The token inside it is a live key to a
 * laundry's customer list, so it must not outlive the process, and a code
 * scanned last week must not quietly connect an account created today.
 */

import type { PendingScan } from './domain/welcome-flow';

let pending: PendingScan | null = null;

export function setPendingScan(scan: PendingScan): void {
  pending = scan;
}

export function peekPendingScan(): PendingScan | null {
  return pending;
}

/** Reads and clears in one step, so a scan can only ever be finished once. */
export function takePendingScan(): PendingScan | null {
  const taken = pending;
  pending = null;
  return taken;
}

export function clearPendingScan(): void {
  pending = null;
}
