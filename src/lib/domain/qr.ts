/**
 * The two codes MiLaundry prints, and how the app reads them.
 *
 * Both codes are web links (`/join/<shop>`, `/claim/<order>`), so a phone
 * camera with no app installed lands on the shop's page or the order's claim
 * page, while the app's scanner still connects the account or claims the
 * load. Reading is wider than writing: codes already printed carry the old
 * scheme and the old `/shop` and `/order` paths, and every one of them must
 * keep scanning.
 */
import { acceptedHosts, claimUrl, joinUrl } from './web-links';

export type QrPayloadType = 'shop' | 'order';

export interface QrPayload {
  type: QrPayloadType;
  id: string;
  token: string;
}

const APP_SCHEME = 'milaundry://';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a route parameter is shaped like one of our ids. */
export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Each path the app owns, and which kind of code it is. */
const PATH_TYPES: Readonly<Record<string, QrPayloadType>> = Object.freeze({
  shop: 'shop',
  join: 'shop',
  order: 'order',
  claim: 'order',
});

export function buildShopQr(shopId: string, token: string): string {
  return joinUrl(shopId, token);
}

export function buildOrderQr(orderId: string, token: string): string {
  return claimUrl(orderId, token);
}

/** The part after the scheme and host, or null when the code is not ours. */
function ownedPath(raw: string, hosts: readonly string[]): string | null {
  if (raw.startsWith(APP_SCHEME)) return raw.slice(APP_SCHEME.length);
  for (const host of hosts) {
    const prefix = `https://${host}/`;
    if (raw.startsWith(prefix)) return raw.slice(prefix.length);
  }
  return null;
}

export function parseQrPayload(
  raw: string,
  hosts: readonly string[] = acceptedHosts()
): QrPayload | null {
  if (!raw) return null;

  const path = ownedPath(raw, hosts);
  if (path === null) return null;

  const match = path.match(/^([a-z]+)\/([^/?#]+)\?token=([^&#]+)$/);
  if (!match) return null;

  const [, segment, id, encodedToken] = match;
  // A plain lookup would find Object.prototype members: /constructor/<id> is
  // not a code of ours.
  if (!Object.prototype.hasOwnProperty.call(PATH_TYPES, segment)) return null;
  const type = PATH_TYPES[segment];
  if (!UUID_RE.test(id)) return null;

  const token = decodeURIComponent(encodedToken);
  if (!token) return null;

  return { type, id, token };
}
