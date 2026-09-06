/**
 * What a scan does once the code is recognised.
 *
 * The camera reads two kinds of MiLaundry code. The one on the counter
 * connects the customer to the shop. The one printed on the receipt stapled
 * to their bag claims that load: it puts the ticket on their account, so the
 * wash can be followed from the phone and paid from it. A receipt scanned by
 * the account that already holds the order simply opens it — the server treats
 * that as the same claim made twice, not as a refusal.
 *
 * This module owns the words and the routes. The scanner owns the camera.
 */
import type { QrPayload } from './qr';
import { scanProblem } from './welcome-flow';

/** The line under the viewfinder, so nobody wonders which code to point at. */
export function scanHint(): string {
  return 'Scan the code at the counter to connect to a shop, or the code on your receipt to claim that load.';
}

/** Where the customer lands once the scan has done its work. */
export function routeAfterScan(scan: QrPayload): string {
  if (scan.type === 'order') return `/(customer)/order/${scan.id}`;
  return `/(customer)/shop/${scan.id}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '';
}

function isNetworkFailure(message: string): boolean {
  return /network request failed|fetch failed|failed to fetch/i.test(message);
}

/**
 * The sentence shown when the server refuses the scan. The RPC messages are
 * written for a log; these are written for the person holding the receipt.
 */
export function scanFailure(scan: QrPayload, error: unknown): string {
  const message = errorMessage(error);
  if (isNetworkFailure(message)) return scanProblem('network');

  if (scan.type === 'order' && /another account/i.test(message)) {
    return "This receipt's load is already on another account. Ask the shop if that isn't right.";
  }
  if (/^invalid (order|shop) qr$/i.test(message)) return scanProblem('inactive');

  return message || "We could not finish that scan. Try again.";
}
