/**
 * Printing through the browser's print window: the website's printer.
 *
 * The receipt is written into a hidden frame and that frame is printed, so
 * the print window shows only the slip and not the dashboard around it. The
 * frame stays until the print window closes; removing it sooner cancels the
 * job in some browsers.
 */

import QRCode from 'qrcode';

import { receiptToHtml } from '../domain/receipt-html';
import type { ReceiptLine } from '../domain/receipt';
import type { BrowserPrintOptions } from './browser-print';

export type { BrowserPrintOptions } from './browser-print';

/** Long enough for any print window to have read the frame, if `afterprint` never fires. */
const FRAME_LIFETIME_MS = 60_000;
/** Some browsers never fire load for a written document; it is ready by then anyway. */
const LOAD_FALLBACK_MS = 300;

export function isBrowserPrintSupported(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

async function drawQrs(lines: readonly ReceiptLine[]): Promise<Record<string, string>> {
  const values = [...new Set(lines.flatMap((line) => (line.kind === 'qr' ? [line.value] : [])))];
  const svgs = await Promise.all(
    values.map((value) => QRCode.toString(value, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' }))
  );
  return Object.fromEntries(values.map((value, index) => [value, svgs[index]]));
}

export async function printInBrowser(lines: readonly ReceiptLine[], options: BrowserPrintOptions): Promise<void> {
  if (!isBrowserPrintSupported()) throw new Error('This browser cannot print.');
  const html = receiptToHtml(lines, { ...options, qrSvgs: await drawQrs(lines) });

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);

  const view = frame.contentWindow;
  if (!view) {
    frame.remove();
    throw new Error('The print window could not open.');
  }

  await new Promise<void>((resolve) => {
    frame.onload = () => resolve();
    view.document.open();
    view.document.write(html);
    view.document.close();
    setTimeout(resolve, LOAD_FALLBACK_MS);
  });

  const cleanup = () => frame.remove();
  view.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(cleanup, FRAME_LIFETIME_MS);
  view.focus();
  view.print();
}
