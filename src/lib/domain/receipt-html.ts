/**
 * The docket for a browser to print.
 *
 * The website has no Bluetooth, so it prints through the computer's own
 * print window instead. The receipt is the same list of lines the thermal
 * printer gets, laid out as a monospace column the width of the paper, so a
 * slip from the browser and a slip from the phone read the same. The text
 * size picks how many characters fit on a line, and the font is sized from
 * that: fewer columns, bigger letters.
 */

import type { PrinterPaper } from './printer';
import type { ReceiptLine } from './receipt';

/** What a thermal head can reach on each roll, in millimetres. */
const PRINTABLE_MM: Record<PrinterPaper, number> = { '58mm': 48, '80mm': 72 };

/** A monospace glyph is 0.6em wide in Courier and its look-alikes. */
const GLYPH_WIDTH_EM = 0.6;

export interface ReceiptHtmlOptions {
  paper: PrinterPaper;
  columns: number;
  title: string;
  /** SVG markup per QR payload, made ahead of time: drawing a QR is async. */
  qrSvgs: Readonly<Record<string, string>>;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The font size, in millimetres, that fits `columns` characters across the roll. */
export function fontSizeMm(paper: PrinterPaper, columns: number): number {
  return Math.round((PRINTABLE_MM[paper] / (columns * GLYPH_WIDTH_EM)) * 100) / 100;
}

function lineHtml(line: ReceiptLine, qrSvgs: ReceiptHtmlOptions['qrSvgs'], isLast: boolean): string {
  switch (line.kind) {
    case 'text': {
      const classes = ['t', line.align ?? 'left', line.bold ? 'b' : '', line.big ? 'big' : ''].filter(Boolean);
      return `<div class="${classes.join(' ')}">${escapeHtml(line.text)}</div>`;
    }
    case 'rule':
      return '<div class="rule"></div>';
    case 'feed':
      return `<div style="height:${Math.max(0, line.lines)}em"></div>`;
    case 'qr': {
      const svg = qrSvgs[line.value];
      return svg ? `<div class="qr">${svg}</div>` : '';
    }
    case 'cut':
      // The last cut is the end of the paper; any earlier one parts two tags.
      return isLast ? '' : '<div class="cut"></div>';
  }
}

export function receiptToHtml(lines: readonly ReceiptLine[], options: ReceiptHtmlOptions): string {
  const { paper, columns, title, qrSvgs } = options;
  const body = lines.map((line, index) => lineHtml(line, qrSvgs, index === lines.length - 1)).join('\n');
  const sideMm = (Number.parseInt(paper, 10) - PRINTABLE_MM[paper]) / 2;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
@page { size: ${paper} auto; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; color: #000; }
body { width: ${paper}; padding: 3mm ${sideMm}mm; }
.paper { font-family: "Courier New", Courier, monospace; font-size: ${fontSizeMm(paper, columns)}mm; line-height: 1.25; }
.t { white-space: pre-wrap; word-break: break-word; }
.center { text-align: center; }
.right { text-align: right; }
.b { font-weight: 700; }
.big { font-size: 2em; line-height: 1.15; }
.rule { border-top: 1px dashed #000; margin: 0.6em 0; }
.qr { display: flex; justify-content: center; margin: 0.4em 0; }
.qr svg { width: 60%; height: auto; }
.cut { border-top: 1px dotted #000; margin: 1.2em 0; }
</style>
</head>
<body><div class="paper">
${body}
</div></body>
</html>`;
}
