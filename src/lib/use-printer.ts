/**
 * The printer as a hook: one state machine the settings card and the order
 * screen both read, backed by the saved-printer store and the BLE transport.
 *
 * Nothing here is clever. Scanning collects advertisements into a list the
 * card ranks; pairing just remembers an id and a name (BLE printers have no
 * bonding step worth the name); printing builds the receipt, hands the bytes
 * to the transport, and reports success or a sentence the merchant can act on.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { OrderWithDetails } from './api';
import {
  DEFAULT_PAPER,
  rankScanResults,
  type PrinterPaper,
  type PrinterState,
  type SavedPrinter,
  type ScannedDevice,
} from './domain/printer';
import { PAPER_COLUMNS, buildReceipt, receiptToEscPos, type ReceiptShop } from './domain/receipt';
import * as transport from './printer/ble-transport';
import { forgetSavedPrinter, loadSavedPrinter, saveSavedPrinter } from './printer-store';

const SCAN_WINDOW_MS = 12_000;

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Something went wrong with the printer.';
}

export function usePrinter() {
  const isSupported = transport.isSupported();
  const [saved, setSaved] = useState<SavedPrinter | null>(null);
  const [state, setState] = useState<PrinterState>(isSupported ? { kind: 'idle', saved: null } : { kind: 'unsupported' });
  const [seen, setSeen] = useState<ScannedDevice[]>([]);
  const scanRef = useRef<transport.ScanHandle | null>(null);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    loadSavedPrinter().then((printer) => {
      if (!alive) return;
      setSaved(printer);
      if (isSupported) setState({ kind: 'idle', saved: printer });
    });
    return () => {
      alive = false;
    };
  }, [isSupported]);

  const stopScan = useCallback(() => {
    scanRef.current?.stop();
    scanRef.current = null;
    if (scanTimer.current) clearTimeout(scanTimer.current);
    scanTimer.current = null;
    setState((current) => (current.kind === 'scanning' ? { kind: 'idle', saved } : current));
  }, [saved]);

  useEffect(() => () => stopScan(), [stopScan]);

  const scan = useCallback(async () => {
    if (!isSupported) return;
    stopScan();
    setSeen([]);
    setState({ kind: 'scanning' });
    try {
      scanRef.current = await transport.startScan(
        (device) => setSeen((list) => [...list, device]),
        (message) => {
          stopScan();
          setState({ kind: 'error', message });
        }
      );
      scanTimer.current = setTimeout(stopScan, SCAN_WINDOW_MS);
    } catch (error) {
      setState({ kind: 'error', message: messageOf(error) });
    }
  }, [isSupported, stopScan]);

  const remember = useCallback(async (printer: SavedPrinter) => {
    await saveSavedPrinter(printer);
    setSaved(printer);
    setState({ kind: 'idle', saved: printer });
  }, []);

  const pair = useCallback(
    async (device: ScannedDevice, paper: PrinterPaper = saved?.paper ?? DEFAULT_PAPER) => {
      stopScan();
      await remember({ id: device.id, name: device.name ?? 'Printer', paper });
    },
    [remember, saved, stopScan]
  );

  const setPaper = useCallback(
    async (paper: PrinterPaper) => {
      if (!saved) return;
      await remember({ ...saved, paper });
    },
    [remember, saved]
  );

  const forget = useCallback(async () => {
    stopScan();
    await forgetSavedPrinter();
    setSaved(null);
    setState({ kind: 'idle', saved: null });
  }, [stopScan]);

  const send = useCallback(
    async (bytes: number[]): Promise<boolean> => {
      if (!saved) {
        setState({ kind: 'error', message: 'No printer is paired. Connect one in Settings.' });
        return false;
      }
      setState({ kind: 'printing' });
      try {
        await transport.printBytes(saved.id, bytes);
        setState({ kind: 'idle', saved });
        return true;
      } catch (error) {
        setState({ kind: 'error', message: messageOf(error) });
        return false;
      }
    },
    [saved]
  );

  const printReceipt = useCallback(
    (order: OrderWithDetails, shop: ReceiptShop): Promise<boolean> => {
      const columns = PAPER_COLUMNS[saved?.paper ?? DEFAULT_PAPER];
      return send(receiptToEscPos(buildReceipt(order, shop, { columns }), columns));
    },
    [saved, send]
  );

  const testPrint = useCallback(
    (shop: ReceiptShop): Promise<boolean> => {
      const columns = PAPER_COLUMNS[saved?.paper ?? DEFAULT_PAPER];
      return send(
        receiptToEscPos(
          [
            { kind: 'text', text: shop.name, align: 'center', bold: true, big: true },
            { kind: 'text', text: 'Printer connected', align: 'center' },
            { kind: 'rule' },
            { kind: 'text', text: `Paper: ${saved?.paper ?? DEFAULT_PAPER}, ${columns} columns` },
            { kind: 'feed', lines: 3 },
            { kind: 'cut' },
          ],
          columns
        )
      );
    },
    [saved, send]
  );

  return {
    isSupported,
    state,
    saved,
    devices: rankScanResults(seen),
    scan,
    stopScan,
    pair,
    setPaper,
    forget,
    printReceipt,
    testPrint,
  };
}
