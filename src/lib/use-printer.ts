/**
 * The printer as a hook: one state machine the settings card, the order
 * screen and the POS all read, backed by the saved-printer store and the
 * BLE transport.
 *
 * The state lives at module level and reaches components through
 * `useSyncExternalStore`, because the merchant tabs stay mounted: pairing a
 * printer in Settings must be seen by a POS screen that mounted earlier,
 * or the print button there stays hidden until the app is killed.
 *
 * Nothing here is clever. Scanning collects advertisements into a list the
 * card ranks; pairing just remembers an id and a name (BLE printers have no
 * bonding step worth the name); printing builds the receipt, hands the bytes
 * to the transport, and reports success or a sentence the merchant can act on.
 */

import { useEffect, useSyncExternalStore } from 'react';

import type { OrderWithDetails } from './api';
import {
  DEFAULT_RECEIPT_SETTINGS,
  rankScanResults,
  textSizeLabel,
  type PrinterPaper,
  type PrinterState,
  type ReceiptSettings,
  type ReceiptTextSize,
  type SavedPrinter,
  type ScannedDevice,
} from './domain/printer';
import {
  buildReceipt,
  receiptColumns,
  receiptToEscPos,
  type PaperColumns,
  type ReceiptLine,
  type ReceiptShop,
} from './domain/receipt';
import { buildTags } from './domain/tag';
import * as transport from './printer/ble-transport';
import { isBrowserPrintSupported, printInBrowser } from './printer/browser-print';
import {
  forgetSavedPrinter,
  loadReceiptSettings,
  loadSavedPrinter,
  saveReceiptSettings,
  saveSavedPrinter,
} from './printer-store';

const SCAN_WINDOW_MS = 12_000;

interface Snapshot {
  isSupported: boolean;
  /** The website: no Bluetooth, but the browser's print window. */
  isBrowser: boolean;
  saved: SavedPrinter | null;
  settings: ReceiptSettings;
  state: PrinterState;
  devices: ScannedDevice[];
}

let snapshot: Snapshot = {
  isSupported: false,
  isBrowser: false,
  saved: null,
  settings: DEFAULT_RECEIPT_SETTINGS,
  state: { kind: 'unsupported' },
  devices: [],
};
let seen: ScannedDevice[] = [];
let scanHandle: transport.ScanHandle | null = null;
let scanTimer: ReturnType<typeof setTimeout> | null = null;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Partial<Snapshot>): void {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => snapshot;

/** Runs once per app session; every hook instance shares the result. */
function ensureLoaded(): Promise<void> {
  if (loaded) return loaded;
  const isSupported = transport.isSupported();
  const isBrowser = !isSupported && isBrowserPrintSupported();
  publish({ isSupported, isBrowser });
  publish({ state: idle() });
  loaded = Promise.all([loadSavedPrinter(), loadReceiptSettings()]).then(([saved, settings]) => {
    publish({ saved, settings });
    publish({ state: idle() });
  });
  return loaded;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong with the printer.';
}

function idle(): PrinterState {
  if (snapshot.isBrowser) return { kind: 'browser' };
  if (!snapshot.isSupported) return { kind: 'unsupported' };
  return { kind: 'idle', saved: snapshot.saved };
}

function stopScan(): void {
  scanHandle?.stop();
  scanHandle = null;
  if (scanTimer) clearTimeout(scanTimer);
  scanTimer = null;
  if (snapshot.state.kind === 'scanning') publish({ state: idle() });
}

async function scan(): Promise<void> {
  if (!snapshot.isSupported) return;
  stopScan();
  seen = [];
  publish({ devices: [], state: { kind: 'scanning' } });
  try {
    scanHandle = await transport.startScan(
      (device) => {
        seen = [...seen, device];
        publish({ devices: rankScanResults(seen) });
      },
      (message) => {
        stopScan();
        publish({ state: { kind: 'error', message } });
      }
    );
    scanTimer = setTimeout(stopScan, SCAN_WINDOW_MS);
  } catch (error) {
    publish({ state: { kind: 'error', message: messageOf(error) } });
  }
}

async function remember(printer: SavedPrinter): Promise<void> {
  await saveSavedPrinter(printer);
  publish({ saved: printer, state: { kind: 'idle', saved: printer } });
}

/** The paired printer's paper wins; without one, the browser's choice. */
function paperNow(): PrinterPaper {
  return snapshot.saved?.paper ?? snapshot.settings.paper;
}

async function pair(device: ScannedDevice, paper?: PrinterPaper): Promise<void> {
  stopScan();
  await remember({
    id: device.id,
    name: device.name ?? 'Printer',
    paper: paper ?? paperNow(),
  });
}

async function rememberSettings(next: ReceiptSettings): Promise<void> {
  publish({ settings: next });
  await saveReceiptSettings(next);
}

async function setPaper(paper: PrinterPaper): Promise<void> {
  await rememberSettings({ ...snapshot.settings, paper });
  if (snapshot.saved) await remember({ ...snapshot.saved, paper });
}

async function setTextSize(textSize: ReceiptTextSize): Promise<void> {
  await rememberSettings({ ...snapshot.settings, textSize });
}

async function forget(): Promise<void> {
  stopScan();
  await forgetSavedPrinter();
  publish({ saved: null });
  publish({ state: idle() });
}

function columnsNow(): PaperColumns {
  return receiptColumns(paperNow(), snapshot.settings.textSize, snapshot.isBrowser ? 'browser' : 'thermal');
}

async function deliver(lines: ReceiptLine[], title: string): Promise<void> {
  const columns = columnsNow();
  if (snapshot.isBrowser) {
    await printInBrowser(lines, { paper: paperNow(), columns, title });
    return;
  }
  const { saved } = snapshot;
  if (!saved) throw new Error('No printer is paired. Connect one in Settings.');
  await transport.printBytes(saved.id, receiptToEscPos(lines, columns, snapshot.settings.textSize));
}

async function send(lines: ReceiptLine[], title = 'Receipt'): Promise<boolean> {
  publish({ state: { kind: 'printing' } });
  try {
    await deliver(lines, title);
    publish({ state: idle() });
    return true;
  } catch (error) {
    publish({ state: { kind: 'error', message: messageOf(error) } });
    return false;
  }
}

function printReceipt(order: OrderWithDetails, shop: ReceiptShop): Promise<boolean> {
  return send(buildReceipt(order, shop, { columns: columnsNow() }));
}

/** The bag tags: name, phone and a shop-only QR, one per bag. */
function printTags(order: OrderWithDetails, shop: ReceiptShop, count: number): Promise<boolean> {
  return send(buildTags(order, shop, { columns: columnsNow(), count }));
}

function testPrint(shop: ReceiptShop): Promise<boolean> {
  const { textSize } = snapshot.settings;
  return send(
    [
      { kind: 'text', text: shop.name, align: 'center', bold: true, big: true },
      { kind: 'text', text: snapshot.isBrowser ? 'Browser printing' : 'Printer connected', align: 'center' },
      { kind: 'rule' },
      { kind: 'text', text: `Paper: ${paperNow()}, ${columnsNow()} columns` },
      { kind: 'text', text: `Text size: ${textSizeLabel(textSize)}` },
      { kind: 'text', text: 'Docket 0000', bold: true, big: true },
      { kind: 'text', text: '1234567890'.repeat(8).slice(0, columnsNow()) },
      { kind: 'feed', lines: 3 },
      { kind: 'cut' },
    ],
    'Test slip'
  );
}

/** Any ready-made slip — the Z-report — at the paired paper width. */
function printLines(build: (columns: PaperColumns) => ReceiptLine[]): Promise<boolean> {
  return send(build(columnsNow()));
}

/** Surfaces a failure that happened outside the transport, in the same place. */
function reportError(message: string): void {
  publish({ state: { kind: 'error', message } });
}

export function usePrinter() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void ensureLoaded();
  }, []);

  return {
    ...current,
    /** A slip can go out now: a paired Bluetooth printer, or the browser's print window. */
    canPrint: current.isBrowser || (current.isSupported && current.saved !== null),
    /** The paper the next slip prints on, paired printer or not. */
    paper: current.saved?.paper ?? current.settings.paper,
    scan,
    stopScan,
    pair,
    setPaper,
    setTextSize,
    forget,
    printReceipt,
    printTags,
    testPrint,
    printLines,
    reportError,
  };
}
