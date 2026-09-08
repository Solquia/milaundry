/**
 * What a printed link does when the OS opens the app with it.
 *
 * The counter code and the receipt code are web links. A phone without the
 * app opens the page; a phone with the app verified for the host opens the
 * app on the same route. In the app that route must do what the scanner
 * does — connect the shop or claim the load — not draw the web page.
 *
 * This module decides which of those it is. The route owns the pixels.
 */
import { type QrPayload, type QrPayloadType, isUuid } from './qr';

export interface LinkLandingInput {
  type: QrPayloadType;
  id: string | undefined;
  token: string | string[] | undefined;
  /** `Platform.OS`: the web page is the answer everywhere but the app. */
  platform: string;
  isAuthLoading: boolean;
  hasSession: boolean;
}

export type LinkLanding =
  | { kind: 'web-page' }
  | { kind: 'waiting' }
  | { kind: 'malformed' }
  | { kind: 'finish'; scan: QrPayload }
  | { kind: 'hand-off'; scan: QrPayload };

/** Where a signed-out customer is sent, with the scan waiting for them. */
export const HAND_OFF_ROUTE = '/sign-in';

/**
 * The code a route's params carry, held to the same shape the scanner
 * accepts from the camera. A repeated query key arrives as an array.
 */
export function linkPayload(
  type: QrPayloadType,
  id: string | undefined,
  token: string | string[] | undefined
): QrPayload | null {
  const first = Array.isArray(token) ? token[0] : token;
  if (!id || !isUuid(id) || !first) return null;
  return { type, id, token: first };
}

export function linkLanding(input: LinkLandingInput): LinkLanding {
  if (input.platform === 'web') return { kind: 'web-page' };

  const scan = linkPayload(input.type, input.id, input.token);
  if (!scan) return { kind: 'malformed' };
  if (input.isAuthLoading) return { kind: 'waiting' };
  return input.hasSession ? { kind: 'finish', scan } : { kind: 'hand-off', scan };
}
