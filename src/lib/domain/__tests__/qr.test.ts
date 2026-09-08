import { buildShopQr, buildOrderQr, parseQrPayload } from '../qr';

const SHOP_ID = '2f6f2f9e-6f0a-4a8e-9a3b-1c2d3e4f5a6b';
const ORDER_ID = 'a1b2c3d4-e5f6-4a8e-9a3b-0f1e2d3c4b5a';
const TOKEN = 'tok_8f14e45fceea167a';

describe('QR payload build/parse', () => {
  it('round-trips a shop QR payload', () => {
    const url = buildShopQr(SHOP_ID, TOKEN);
    expect(parseQrPayload(url)).toEqual({ type: 'shop', id: SHOP_ID, token: TOKEN });
  });

  it('round-trips an order QR payload', () => {
    const url = buildOrderQr(ORDER_ID, TOKEN);
    expect(parseQrPayload(url)).toEqual({ type: 'order', id: ORDER_ID, token: TOKEN });
  });

  it('prints the shop code as a web link a phone camera can open', () => {
    expect(buildShopQr(SHOP_ID, TOKEN)).toBe(
      `https://milaundry.app/join/${SHOP_ID}?token=${TOKEN}`
    );
  });

  it('prints the receipt code as a web link a phone camera can open', () => {
    expect(buildOrderQr(ORDER_ID, TOKEN)).toBe(
      'https://milaundry.app/claim/' + ORDER_ID + '?token=' + TOKEN
    );
  });

  it('still reads the deep-link shop codes already printed', () => {
    expect(parseQrPayload(`milaundry://shop/${SHOP_ID}?token=${TOKEN}`)).toEqual({
      type: 'shop',
      id: SHOP_ID,
      token: TOKEN,
    });
  });

  it('reads the web claim and join paths as order and shop codes', () => {
    expect(parseQrPayload(`https://milaundry.app/claim/${ORDER_ID}?token=${TOKEN}`)).toEqual({
      type: 'order',
      id: ORDER_ID,
      token: TOKEN,
    });
    expect(parseQrPayload(`https://milaundry.app/join/${SHOP_ID}?token=${TOKEN}`)).toEqual({
      type: 'shop',
      id: SHOP_ID,
      token: TOKEN,
    });
  });

  it('accepts a code printed for a configured host', () => {
    expect(
      parseQrPayload(`https://laundry.example.ph/join/${SHOP_ID}?token=${TOKEN}`, [
        'laundry.example.ph',
        'milaundry.app',
      ])
    ).toEqual({ type: 'shop', id: SHOP_ID, token: TOKEN });
  });

  it('refuses a web path the app does not own', () => {
    expect(parseQrPayload(`https://milaundry.app/s/sparkle-wash?token=${TOKEN}`)).toBeNull();
  });

  it('refuses a path that only exists on Object.prototype', () => {
    expect(parseQrPayload('https://milaundry.app/constructor/' + SHOP_ID + '?token=' + TOKEN)).toBeNull();
    expect(parseQrPayload('milaundry://toString/' + SHOP_ID + '?token=' + TOKEN)).toBeNull();
  });

  it('parses https fallback links too', () => {
    expect(
      parseQrPayload(`https://milaundry.app/order/${ORDER_ID}?token=${TOKEN}`)
    ).toEqual({ type: 'order', id: ORDER_ID, token: TOKEN });
  });

  it('returns null for unrelated or malformed payloads', () => {
    expect(parseQrPayload('hello world')).toBeNull();
    expect(parseQrPayload('https://example.com/order/123?token=x')).toBeNull();
    expect(parseQrPayload('milaundry://unknown/abc?token=x')).toBeNull();
    expect(parseQrPayload('')).toBeNull();
  });

  it('returns null when the token is missing', () => {
    expect(parseQrPayload(`milaundry://order/${ORDER_ID}`)).toBeNull();
  });

  it('returns null when the id is not a uuid', () => {
    expect(parseQrPayload(`milaundry://order/not-a-uuid?token=${TOKEN}`)).toBeNull();
  });
});
