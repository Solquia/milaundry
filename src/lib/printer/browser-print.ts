/**
 * Printing through the browser's print window: the website's printer.
 *
 * A phone prints over Bluetooth (`ble-transport`), so this native half only
 * says no. The real one is `browser-print.web.ts`.
 */

import type { PrinterPaper } from '../domain/printer';
import type { ReceiptLine } from '../domain/receipt';

export interface BrowserPrintOptions {
  paper: PrinterPaper;
  columns: number;
  title: string;
}

export function isBrowserPrintSupported(): boolean {
  return false;
}

export async function printInBrowser(_lines: readonly ReceiptLine[], _options: BrowserPrintOptions): Promise<void> {
  throw new Error('Browser printing is only on the website.');
}
