export type QrPayloadType = 'shop' | 'order';

export interface QrPayload {
  type: QrPayloadType;
  id: string;
  token: string;
}

const APP_SCHEME = 'milaundry://';
const WEB_HOST = 'milaundry.app';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildShopQr(shopId: string, token: string): string {
  return `${APP_SCHEME}shop/${shopId}?token=${encodeURIComponent(token)}`;
}

export function buildOrderQr(orderId: string, token: string): string {
  return `${APP_SCHEME}order/${orderId}?token=${encodeURIComponent(token)}`;
}

export function parseQrPayload(raw: string): QrPayload | null {
  if (!raw) return null;

  let path: string;
  if (raw.startsWith(APP_SCHEME)) {
    path = raw.slice(APP_SCHEME.length);
  } else if (raw.startsWith(`https://${WEB_HOST}/`)) {
    path = raw.slice(`https://${WEB_HOST}/`.length);
  } else {
    return null;
  }

  const match = path.match(/^(shop|order)\/([^/?#]+)\?token=([^&#]+)$/);
  if (!match) return null;

  const [, type, id, encodedToken] = match;
  if (!UUID_RE.test(id)) return null;

  const token = decodeURIComponent(encodedToken);
  if (!token) return null;

  return { type: type as QrPayloadType, id, token };
}
