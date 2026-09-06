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
  DEFAULT_PAPER,
  rankScanResults,
  type PrinterPaper,
  type PrinterState,
  type SavedPrinter,
  type ScannedDevice,
} from './domain/printer';
import { PAPER_COLUMNS, buildReceipt, receiptToEscPos, type ReceiptLine, type ReceiptShop } from './domain/receipt';
import * as transport from './printer/ble-transport';
import { forgetSavedPrinter, loadSavedPrinter, saveSavedPrinter } from './printer-store';

const SCAN_WINDOW_MS = 12_000;

interface Snapshot {
  isSupported: boolean;
  saved: SavedPrinter | null;
  state: PrinterState;
  devices: ScannedDevice[];
}

let snapshot: Snapshot = {
  isSupported: false,
  saved: null,
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
  publish({ isSupported, state: isSupported ? { kind: 'idle', saved: null } : { kind: 'unsupported' } });
  loaded = loadSavedPrinter().then((saved) => {
    publish({ saved, state: isSupported ? { kind: 'idle', saved } : { kind: 'unsupported' } });
  });
  return loaded;
}

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong with the printer.';
}

function idle(): PrinterState {
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

async function pair(device: ScannedDevice, paper?: PrinterPaper): Promise<void> {
  stopScan();
  await remember({
    id: device.id,
    name: device.name ?? 'Printer',
    paper: paper ?? snapshot.saved?.paper ?? DEFAULT_PAPER,
  });
}

async function setPaper(paper: PrinterPaper): Promise<void> {
  if (!snapshot.saved) return;
  await remember({ ...snapshot.saved, paper });
}

async function forget(): Promise<void> {
  stopScan();
  await forgetSavedPrinter();
  publish({ saved: null, state: { kind: 'idle', saved: null } });
}

function columnsNow() {
  return PAPER_COLUMNS[snapshot.saved?.paper ?? DEFAULT_PAPER];
}

async function send(lines: ReceiptLine[]): Promise<boolean> {
  const { saved } = snapshot;
  if (!saved) {
    publish({ state: { kind: 'error', message: 'No printer is paired. Connect one in Settings.' } });
    return false;
  }
  const columns = columnsNow();
  publish({ state: { kind: 'printing' } });
  try {
    await transport.printBytes(saved.id, receiptToEscPos(lines, columns));
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

function testPrint(shop: ReceiptShop): Promise<boolean> {
  const paper = snapshot.saved?.paper ?? DEFAULT_PAPER;
  return send([
    { kind: 'text', text: shop.name, align: 'center', bold: true, big: true },
    { kind: 'text', text: 'Printer connected', align: 'center' },
    { kind: 'rule' },
    { kind: 'text', text: `Paper: ${paper}, ${columnsNow()} columns` },
    { kind: 'feed', lines: 3 },
    { kind: 'cut' },
  ]);
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
    scan,
    stopScan,
    pair,
    setPaper,
    forget,
    printReceipt,
    testPrint,
    reportError,
  };
}
