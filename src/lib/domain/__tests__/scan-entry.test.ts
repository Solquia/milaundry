import { parseTypedCode, scanEntryMode, typedCodeCopy } from '../scan-entry';
import { claimUrl, joinUrl } from '../web-links';

const SHOP_ID = '2f6f2f9e-6f0a-4a8e-9a3b-1c2d3e4f5a6b';
const ORDER_ID = 'a1b2c3d4-e5f6-4a8e-9a3b-0f1e2d3c4b5a';
const TOKEN = '8f14e45f-ceea-467a-9b1c-2d3e4f5a6b7c';

describe('scanEntryMode', () => {
  it('uses the camera in the app and a typed code in a browser', () => {
    expect(scanEntryMode('ios')).toBe('camera');
    expect(scanEntryMode('android')).toBe('camera');
    expect(scanEntryMode('web')).toBe('typed');
  });
});

describe('parseTypedCode', () => {
  it('reads a pasted link the same way the camera reads the printed code', () => {
    expect(parseTypedCode(joinUrl(SHOP_ID, TOKEN))).toEqual({ type: 'shop', id: SHOP_ID, token: TOKEN });
    expect(parseTypedCode(claimUrl(ORDER_ID, TOKEN))).toEqual({ type: 'order', id: ORDER_ID, token: TOKEN });
  });

  it('forgives the whitespace a copy-paste carries', () => {
    expect(parseTypedCode(`  ${claimUrl(ORDER_ID, TOKEN)}\n`)).toEqual({ type: 'order', id: ORDER_ID, token: TOKEN });
  });

  it('refuses anything that is not one of our links', () => {
    expect(parseTypedCode('')).toBeNull();
    expect(parseTypedCode('https://example.com/claim/x')).toBeNull();
    expect(parseTypedCode('hello')).toBeNull();
  });
});

describe('typedCodeCopy', () => {
  it('tells the person where the link is printed', () => {
    const copy = typedCodeCopy();
    expect(copy.title.length).toBeGreaterThan(0);
    expect(copy.hint).toMatch(/receipt|counter/i);
    expect(copy.placeholder).toMatch(/^https:\/\//);
    expect(copy.submit.length).toBeGreaterThan(0);
  });
});
