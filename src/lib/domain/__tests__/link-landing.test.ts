import { HAND_OFF_ROUTE, linkLanding, linkPayload } from '../link-landing';
import { parseQrPayload } from '../qr';
import { claimUrl, joinUrl } from '../web-links';

const SHOP_ID = '2f6f2f9e-6f0a-4a8e-9a3b-1c2d3e4f5a6b';
const ORDER_ID = 'a1b2c3d4-e5f6-4a8e-9a3b-0f1e2d3c4b5a';
const TOKEN = '8f14e45f-ceea-467a-9b1c-2d3e4f5a6b7c';

const native = {
  type: 'order' as const,
  id: ORDER_ID,
  token: TOKEN,
  platform: 'android',
  isAuthLoading: false,
  hasSession: true,
};

describe('linkPayload', () => {
  it('reads the same code the scanner reads from the printed link', () => {
    expect(linkPayload('shop', SHOP_ID, TOKEN)).toEqual(parseQrPayload(joinUrl(SHOP_ID, TOKEN)));
    expect(linkPayload('order', ORDER_ID, TOKEN)).toEqual(parseQrPayload(claimUrl(ORDER_ID, TOKEN)));
  });

  it('takes the first token when the router repeats the key', () => {
    expect(linkPayload('order', ORDER_ID, [TOKEN, 'other'])).toEqual({ type: 'order', id: ORDER_ID, token: TOKEN });
  });

  it('refuses a link with no id, a non-uuid id, or an empty token', () => {
    expect(linkPayload('order', undefined, TOKEN)).toBeNull();
    expect(linkPayload('order', 'not-an-id', TOKEN)).toBeNull();
    expect(linkPayload('order', ORDER_ID, '')).toBeNull();
    expect(linkPayload('order', ORDER_ID, undefined)).toBeNull();
  });
});

describe('linkLanding', () => {
  it('shows the web page in a browser, whatever the session state', () => {
    expect(linkLanding({ ...native, platform: 'web' })).toEqual({ kind: 'web-page' });
    expect(linkLanding({ ...native, platform: 'web', hasSession: false, isAuthLoading: true })).toEqual({
      kind: 'web-page',
    });
  });

  it('in the app, finishes the scan for a signed-in customer', () => {
    expect(linkLanding(native)).toEqual({
      kind: 'finish',
      scan: { type: 'order', id: ORDER_ID, token: TOKEN },
    });
  });

  it('in the app, hands a signed-out customer to sign-in with the scan kept', () => {
    expect(linkLanding({ ...native, hasSession: false })).toEqual({
      kind: 'hand-off',
      scan: { type: 'order', id: ORDER_ID, token: TOKEN },
    });
    expect(HAND_OFF_ROUTE).toBe('/sign-in');
  });

  it('in the app, waits while the session is still being restored', () => {
    expect(linkLanding({ ...native, hasSession: false, isAuthLoading: true })).toEqual({ kind: 'waiting' });
  });

  it('in the app, calls a broken link malformed before waiting on anything', () => {
    expect(linkLanding({ ...native, id: 'nope', isAuthLoading: true })).toEqual({ kind: 'malformed' });
  });

  it('treats iOS like Android', () => {
    expect(linkLanding({ ...native, platform: 'ios', type: 'shop', id: SHOP_ID })).toEqual({
      kind: 'finish',
      scan: { type: 'shop', id: SHOP_ID, token: TOKEN },
    });
  });
});
