/**
 * What the app knows about the shop's receipt printer, without a radio.
 *
 * The radio work lives in `printer/ble-transport`; this file holds the parts
 * that can be reasoned about on paper: which of the things a Bluetooth scan
 * turns up look like printers, what to remember about the one the merchant
 * picked, which characteristic the receipt bytes should be written to, and
 * the words the settings card shows for each state.
 */

export type PrinterPaper = '58mm' | '80mm';

export const DEFAULT_PAPER: PrinterPaper = '58mm';

export interface SavedPrinter {
  /** The BLE peripheral id: a MAC on Android, a per-phone uuid on iOS. */
  id: string;
  name: string;
  paper: PrinterPaper;
}

export interface ScannedDevice {
  id: string;
  name: string | null;
  rssi: number | null;
}

export interface WritableCharacteristic {
  serviceUUID: string;
  uuid: string;
  isWritableWithResponse: boolean;
  isWritableWithoutResponse: boolean;
}

export type PrinterState =
  | { kind: 'unsupported' }
  | { kind: 'idle'; saved: SavedPrinter | null }
  | { kind: 'scanning' }
  | { kind: 'connecting' }
  | { kind: 'printing' }
  | { kind: 'error'; message: string };

function isPaper(value: unknown): value is PrinterPaper {
  return value === '58mm' || value === '80mm';
}

/** Never throws: an unreadable record means "no printer", not a crash at launch. */
export function parseSavedPrinter(raw: string | null | undefined): SavedPrinter | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.id !== 'string' || record.id.length === 0) return null;
    return {
      id: record.id,
      name: typeof record.name === 'string' && record.name.length > 0 ? record.name : 'Printer',
      paper: isPaper(record.paper) ? record.paper : DEFAULT_PAPER,
    };
  } catch {
    return null;
  }
}

/**
 * The names cheap thermal printers advertise. There is no BLE service that
 * says "I am a printer" (most expose a generic serial-port profile), so the
 * name is the only hint, and this list is the field guide.
 */
const PRINTER_NAME_HINTS = [
  /print/i,
  /^MTP/i,
  /^PT-?\d/i,
  /^XP-/i,
  /^RPP/i,
  /^POS/i,
  /GOOJPRT/i,
  /^BlueTooth/i,
  /^JP-?\d/i,
  /^ZJ-?\d/i,
  /thermal/i,
  /receipt/i,
];

export function looksLikePrinter(name: string | null | undefined): boolean {
  if (!name) return false;
  return PRINTER_NAME_HINTS.some((hint) => hint.test(name));
}

/**
 * One row per device, printer-like names first, then named devices, then the
 * anonymous ones; stronger signal wins ties. A scan reports the same printer
 * many times a second, so this is also where the duplicates collapse, with
 * the latest reading kept.
 */
export function rankScanResults(seen: readonly ScannedDevice[]): ScannedDevice[] {
  const latest = new Map<string, ScannedDevice>();
  for (const device of seen) latest.set(device.id, device);

  const tier = (device: ScannedDevice): number =>
    looksLikePrinter(device.name) ? 0 : device.name ? 1 : 2;

  return [...latest.values()].sort((a, b) => {
    const byTier = tier(a) - tier(b);
    if (byTier !== 0) return byTier;
    return (b.rssi ?? -Infinity) - (a.rssi ?? -Infinity);
  });
}

/** Short-form UUIDs of the characteristics the common printer chipsets take bytes on. */
const KNOWN_WRITE_UUIDS = ['2af1', 'ffe1', 'ff02', 'fff2', 'ae01', 'bef8'];

function shortUuid(uuid: string): string {
  const lower = uuid.toLowerCase();
  // 0000xxxx-0000-1000-8000-00805f9b34fb is the Bluetooth base; keep the xxxx.
  const base = /^0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/.exec(lower);
  return base ? base[1] : lower;
}

export function pickWriteCharacteristic<T extends WritableCharacteristic>(
  characteristics: readonly T[]
): T | null {
  const writable = characteristics.filter(
    (c) => c.isWritableWithResponse || c.isWritableWithoutResponse
  );
  const known = writable.find((c) => KNOWN_WRITE_UUIDS.includes(shortUuid(c.uuid)));
  return known ?? writable[0] ?? null;
}

export interface PrinterCopy {
  title: string;
  caption: string;
}

export function printerCopy(state: PrinterState): PrinterCopy {
  switch (state.kind) {
    case 'unsupported':
      return {
        title: 'Printing needs a development build',
        caption: 'Bluetooth printers are not available in Expo Go or on the web.',
      };
    case 'idle':
      return state.saved
        ? { title: state.saved.name, caption: `Remembered, ${state.saved.paper} paper` }
        : { title: 'No printer connected', caption: 'Pair a Bluetooth receipt printer to print dockets.' };
    case 'scanning':
      return { title: 'Looking for printers', caption: 'Turn the printer on and keep it close.' };
    case 'connecting':
      return { title: 'Connecting', caption: 'Waking the printer up.' };
    case 'printing':
      return { title: 'Printing', caption: 'Sending the receipt.' };
    case 'error':
      return { title: 'Printer problem', caption: state.message };
  }
}
