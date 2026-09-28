import { buildOrderQr, buildShopQr, buildTagQr } from '../qr';
import {
  merchantScanFailure,
  merchantScanRoute,
  readMerchantCode,
} from '../merchant-scan';

const SHOP_ID = '2f6f2f9e-6f0a-4a8e-9a3b-1c2d3e4f5a6b';
const ORDER_ID = 'a1b2c3d4-e5f6-4a8e-9a3b-0f1e2d3c4b5a';

describe('readMerchantCode', () => {
  it('opens the order a bag tag points at', () => {
    expect(readMerchantCode(buildTagQr(ORDER_ID))).toEqual({ kind: 'order', orderId: ORDER_ID });
  });

  it('opens the order a customer receipt points at, without keeping its token', () => {
    expect(readMerchantCode(buildOrderQr(ORDER_ID, 'tok'))).toEqual({ kind: 'order', orderId: ORDER_ID });
  });

  it('says the counter code is for customers', () => {
    expect(readMerchantCode(buildShopQr(SHOP_ID, 'tok'))).toEqual({ kind: 'counter' });
  });

  it('says a code that is not ours is not ours', () => {
    expect(readMerchantCode('https://example.com/whatever')).toEqual({ kind: 'unknown' });
    expect(readMerchantCode('  ')).toEqual({ kind: 'unknown' });
  });

  it('reads a code with the whitespace a barcode gun types after it', () => {
    expect(readMerchantCode(`${buildTagQr(ORDER_ID)}\n`)).toEqual({ kind: 'order', orderId: ORDER_ID });
  });
});

describe('merchantScanRoute', () => {
  it('lands on the merchant order screen', () => {
    expect(merchantScanRoute(ORDER_ID)).toBe(`/(merchant)/order/${ORDER_ID}`);
  });
});

describe('merchantScanFailure', () => {
  it('reads a missing row as a tag from another shop', () => {
    const message = merchantScanFailure(new Error('JSON object requested, multiple (or no) rows returned'));
    expect(message).toMatch(/another shop/i);
  });

  it('tells the counter to check the signal when the network drops', () => {
    expect(merchantScanFailure(new Error('Network request failed'))).toMatch(/signal/i);
  });
});
