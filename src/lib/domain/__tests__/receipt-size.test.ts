import { ESC, GS } from '../escpos';
import { DEFAULT_RECEIPT_SETTINGS, parseReceiptSettings, printerCopy, textSizeLabel } from '../printer';
import { receiptColumns, receiptToEscPos, type ReceiptLine } from '../receipt';
import { escapeHtml, fontSizeMm, receiptToHtml } from '../receipt-html';

// The receipt text size is a per-device choice: small packs more on a line,
// large prints taller on the thermal printer and wider in the browser.

function indexOfSequence(bytes: number[], sequence: number[]): number {
  for (let at = 0; at <= bytes.length - sequence.length; at += 1) {
    if (sequence.every((b, i) => bytes[at + i] === b)) return at;
  }
  return -1;
}

describe('receiptColumns', () => {
  it('keeps font A columns for normal text on both papers', () => {
    expect(receiptColumns('58mm', 'normal')).toBe(32);
    expect(receiptColumns('80mm', 'normal')).toBe(48);
  });

  it('fits more characters on a line for small text', () => {
    expect(receiptColumns('58mm', 'small')).toBe(42);
    expect(receiptColumns('80mm', 'small')).toBe(64);
  });

  it('keeps the column count for large thermal text, which is only taller', () => {
    expect(receiptColumns('58mm', 'large')).toBe(32);
    expect(receiptColumns('80mm', 'large', 'thermal')).toBe(48);
  });

  it('uses fewer, bigger characters for large text in the browser', () => {
    expect(receiptColumns('58mm', 'large', 'browser')).toBe(24);
    expect(receiptColumns('80mm', 'large', 'browser')).toBe(36);
  });
});

describe('receiptToEscPos text size', () => {
  const lines: ReceiptLine[] = [
    { kind: 'text', text: 'Shop', big: true },
    { kind: 'text', text: 'Body' },
  ];

  it('sends no size commands beyond the big line for normal text', () => {
    const bytes = receiptToEscPos(lines, 32);
    expect(indexOfSequence(bytes, [ESC, 0x4d, 1])).toBe(-1);
    expect(indexOfSequence(bytes, [GS, 0x21, 0x01])).toBe(-1);
  });

  it('switches to font B straight after initialize for small text', () => {
    const bytes = receiptToEscPos(lines, 42, 'small');
    expect(bytes.slice(0, 5)).toEqual([ESC, 0x40, ESC, 0x4d, 1]);
  });

  it('prints large text double height and restores it after a big line', () => {
    const bytes = receiptToEscPos(lines, 32, 'large');
    expect(bytes.slice(0, 5)).toEqual([ESC, 0x40, GS, 0x21, 0x01]);
    const afterBig = indexOfSequence(bytes, [83, 104, 111, 112, 0x0a]) + 5;
    expect(bytes.slice(afterBig, afterBig + 3)).toEqual([GS, 0x21, 0x01]);
  });
});

describe('parseReceiptSettings', () => {
  it('falls back to the defaults for nothing or garbage', () => {
    expect(parseReceiptSettings(null)).toEqual(DEFAULT_RECEIPT_SETTINGS);
    expect(parseReceiptSettings('not json')).toEqual(DEFAULT_RECEIPT_SETTINGS);
    expect(parseReceiptSettings('42')).toEqual(DEFAULT_RECEIPT_SETTINGS);
  });

  it('keeps valid fields and replaces invalid ones', () => {
    expect(parseReceiptSettings('{"paper":"80mm","textSize":"large"}')).toEqual({ paper: '80mm', textSize: 'large' });
    expect(parseReceiptSettings('{"paper":"A4","textSize":"huge"}')).toEqual(DEFAULT_RECEIPT_SETTINGS);
  });

  it('labels each size', () => {
    expect(textSizeLabel('small')).toBe('Small');
    expect(textSizeLabel('large')).toBe('Large');
  });
});

describe('printerCopy for the browser', () => {
  it('says the receipt prints through the browser', () => {
    expect(printerCopy({ kind: 'browser' }).title).toMatch(/browser/i);
  });
});

describe('receiptToHtml', () => {
  const lines: ReceiptLine[] = [
    { kind: 'text', text: 'Suds & <Co>', align: 'center', bold: true, big: true },
    { kind: 'rule' },
    { kind: 'qr', value: 'milaundry://order/1' },
    { kind: 'cut' },
    { kind: 'text', text: 'Tag 2' },
    { kind: 'cut' },
  ];

  it('escapes shop text so a name cannot inject markup', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
    const html = receiptToHtml(lines, { paper: '58mm', columns: 32, title: 'Receipt', qrSvgs: {} });
    expect(html).toContain('Suds &amp; &lt;Co&gt;');
    expect(html).not.toContain('<Co>');
  });

  it('sizes the paper and the font from the paper and columns', () => {
    const html = receiptToHtml(lines, { paper: '80mm', columns: 48, title: 'Receipt', qrSvgs: {} });
    expect(html).toContain('@page { size: 80mm auto');
    expect(html).toContain(`font-size: ${fontSizeMm('80mm', 48)}mm`);
    expect(fontSizeMm('58mm', 24)).toBeGreaterThan(fontSizeMm('58mm', 32));
    expect(fontSizeMm('58mm', 42)).toBeLessThan(fontSizeMm('58mm', 32));
  });

  it('draws the QR it was given and a cut line only between slips', () => {
    const html = receiptToHtml(lines, {
      paper: '58mm',
      columns: 32,
      title: 'Receipt',
      qrSvgs: { 'milaundry://order/1': '<svg id="qr"></svg>' },
    });
    expect(html).toContain('<svg id="qr"></svg>');
    expect(html.match(/class="cut"/g)).toHaveLength(1);
  });
});
