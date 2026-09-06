import {
  DEFAULT_PAPER,
  parseSavedPrinter,
  looksLikePrinter,
  rankScanResults,
  pickWriteCharacteristic,
  printerCopy,
  type ScannedDevice,
} from '../printer';

// The printer module is the part of the feature that can be reasoned about
// without a radio: what we remember about a paired printer, which of the
// devices found by a scan are worth showing, and which GATT characteristic
// the receipt bytes should go to.

describe('parseSavedPrinter', () => {
  it('returns null for nothing, garbage, or a record without an id', () => {
    expect(parseSavedPrinter(null)).toBeNull();
    expect(parseSavedPrinter('not json')).toBeNull();
    expect(parseSavedPrinter(JSON.stringify({ name: 'X' }))).toBeNull();
    expect(parseSavedPrinter(JSON.stringify({ id: 42 }))).toBeNull();
  });

  it('keeps id, name and paper, defaulting a missing or unknown paper', () => {
    expect(parseSavedPrinter(JSON.stringify({ id: 'AA:BB', name: 'MTP-II', paper: '80mm' }))).toEqual({
      id: 'AA:BB',
      name: 'MTP-II',
      paper: '80mm',
    });
    expect(parseSavedPrinter(JSON.stringify({ id: 'AA:BB', paper: 'A4' }))).toEqual({
      id: 'AA:BB',
      name: 'Printer',
      paper: DEFAULT_PAPER,
    });
    expect(DEFAULT_PAPER).toBe('58mm');
  });
});

describe('looksLikePrinter', () => {
  it('recognises the names cheap thermal printers advertise', () => {
    for (const name of ['MTP-II', 'BlueTooth Printer', 'PT-210', 'XP-P300', 'RPP02N', 'Thermal_Printer', 'POS-58', 'GOOJPRT']) {
      expect(looksLikePrinter(name)).toBe(true);
    }
  });

  it('does not flag phones, earbuds or nameless devices', () => {
    expect(looksLikePrinter('Galaxy Buds')).toBe(false);
    expect(looksLikePrinter(null)).toBe(false);
    expect(looksLikePrinter('')).toBe(false);
  });
});

describe('rankScanResults', () => {
  const seen: ScannedDevice[] = [
    { id: '1', name: null, rssi: -40 },
    { id: '2', name: 'Galaxy Buds', rssi: -50 },
    { id: '3', name: 'MTP-II', rssi: -70 },
    { id: '3', name: 'MTP-II', rssi: -60 },
    { id: '4', name: 'PT-210', rssi: -55 },
  ];

  it('dedupes by id, keeps the latest reading, and lists printer-like names first', () => {
    const ranked = rankScanResults(seen);
    expect(ranked.map((d) => d.id)).toEqual(['4', '3', '2', '1']);
    expect(ranked.find((d) => d.id === '3')?.rssi).toBe(-60);
  });

  it('within a tier, stronger signal wins', () => {
    const ranked = rankScanResults([
      { id: 'a', name: 'POS-58', rssi: -80 },
      { id: 'b', name: 'POS-80', rssi: -30 },
    ]);
    expect(ranked.map((d) => d.id)).toEqual(['b', 'a']);
  });
});

describe('pickWriteCharacteristic', () => {
  const c = (serviceUUID: string, uuid: string, withResponse: boolean, withoutResponse: boolean) => ({
    serviceUUID,
    uuid,
    isWritableWithResponse: withResponse,
    isWritableWithoutResponse: withoutResponse,
  });

  it('prefers the well-known printer characteristics over any other writable one', () => {
    const picked = pickWriteCharacteristic([
      c('0000180a-0000-1000-8000-00805f9b34fb', '00002a50-0000-1000-8000-00805f9b34fb', true, false),
      c('000018f0-0000-1000-8000-00805f9b34fb', '00002af1-0000-1000-8000-00805f9b34fb', true, true),
    ]);
    expect(picked?.uuid).toBe('00002af1-0000-1000-8000-00805f9b34fb');
  });

  it('falls back to the first writable characteristic and ignores read-only ones', () => {
    const picked = pickWriteCharacteristic([
      c('s', 'ro', false, false),
      c('s', 'rw', true, false),
    ]);
    expect(picked?.uuid).toBe('rw');
    expect(pickWriteCharacteristic([c('s', 'ro', false, false)])).toBeNull();
  });

  it('matches short-form UUIDs case-insensitively', () => {
    const picked = pickWriteCharacteristic([
      c('s', 'other', true, false),
      c('FFE0', 'FFE1', false, true),
    ]);
    expect(picked?.uuid).toBe('FFE1');
  });
});

describe('printerCopy', () => {
  it('tells the merchant what the card is doing in plain words', () => {
    expect(printerCopy({ kind: 'unsupported' }).title).toMatch(/development build/i);
    expect(printerCopy({ kind: 'idle', saved: null }).title).toBe('No printer connected');
    expect(printerCopy({ kind: 'idle', saved: { id: '1', name: 'MTP-II', paper: '58mm' } }).title).toBe('MTP-II');
    expect(printerCopy({ kind: 'scanning' }).title).toMatch(/looking/i);
    expect(printerCopy({ kind: 'printing' }).title).toMatch(/printing/i);
    expect(printerCopy({ kind: 'error', message: 'Bluetooth is off' }).caption).toBe('Bluetooth is off');
  });
});
