import type { QrPayload } from '../qr';
import { routeAfterScan, scanFailure, scanHint } from '../scan-outcome';

const SHOP_ID = '2f6f2f9e-6f0a-4a8e-9a3b-1c2d3e4f5a6b';
const ORDER_ID = 'a1b2c3d4-e5f6-4a8e-9a3b-0f1e2d3c4b5a';
const shopScan: QrPayload = { type: 'shop', id: SHOP_ID, token: 'tok' };
const orderScan: QrPayload = { type: 'order', id: ORDER_ID, token: 'tok' };

describe('scanHint', () => {
  it('tells the customer the counter code connects and the receipt code claims', () => {
    const hint = scanHint();
    expect(hint).toMatch(/counter/i);
    expect(hint).toMatch(/receipt/i);
    expect(hint).toMatch(/claim/i);
  });
});

describe('routeAfterScan', () => {
  it('lands a shop scan on that shopfront', () => {
    expect(routeAfterScan(shopScan)).toBe(`/(customer)/shop/${SHOP_ID}`);
  });

  it('lands a receipt scan on the claimed order', () => {
    expect(routeAfterScan(orderScan)).toBe(`/(customer)/order/${ORDER_ID}`);
  });
});

describe('scanFailure', () => {
  it('says a receipt already on another account is not theirs to claim', () => {
    const message = scanFailure(orderScan, new Error('order belongs to another account'));
    expect(message).toMatch(/another account/i);
    expect(message).toMatch(/ask the shop/i);
  });

  it('treats a refused receipt code as stale rather than as a bug', () => {
    expect(scanFailure(orderScan, new Error('invalid order QR'))).toMatch(/fresh one/i);
  });

  it('treats a refused shop code as stale', () => {
    expect(scanFailure(shopScan, new Error('invalid shop QR'))).toMatch(/fresh one/i);
  });

  it('blames the signal, not the code, when the request never arrived', () => {
    expect(scanFailure(orderScan, new TypeError('Network request failed'))).toMatch(
      /signal/i
    );
    expect(scanFailure(shopScan, new Error('fetch failed'))).toMatch(/signal/i);
  });

  it('falls back to a plain sentence for anything else', () => {
    expect(scanFailure(orderScan, 'boom')).toMatch(/could not finish/i);
    expect(scanFailure(orderScan, new Error('something odd'))).toBe('something odd');
  });
});
