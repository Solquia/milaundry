/**
 * ESC/POS, the byte language thermal receipt printers speak.
 *
 * Every cheap Bluetooth receipt printer — the MTP-II under the counter, the
 * PT-210 in a rider's bag — understands the same handful of escape sequences
 * Epson published decades ago. There is no library to lean on that works
 * inside an Expo app, and the useful subset is small: reset, align, bold,
 * double size, feed, cut, and the five-step dance that prints a QR code.
 *
 * Everything here is a pure function from arguments to a byte list. The
 * transport (see `printer/ble-transport`) is the only thing that knows about
 * radios; this file only knows about bytes, so it can be tested to the byte.
 */

export const ESC = 0x1b;
export const GS = 0x1d;
const LF = 0x0a;

/** '?' — what a code-page-0 printer would show for a glyph it lacks anyway. */
const REPLACEMENT = 63;

export type Alignment = 'left' | 'center' | 'right';

const ALIGNMENTS: Record<Alignment, number> = { left: 0, center: 1, right: 2 };

/** ESC @ — clears any bold, size or alignment left over from the last job. */
export function initialize(): number[] {
  return [ESC, 0x40];
}

export function align(where: Alignment): number[] {
  return [ESC, 0x61, ALIGNMENTS[where]];
}

export function bold(on: boolean): number[] {
  return [ESC, 0x45, on ? 1 : 0];
}

/** GS ! — 0x11 doubles both width and height; 0x00 is normal. */
export function doubleSize(on: boolean): number[] {
  return [GS, 0x21, on ? 0x11 : 0x00];
}

function byte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** ESC d n — feed n lines. */
export function feed(lines: number): number[] {
  return [ESC, 0x64, byte(lines)];
}

/**
 * GS V 66 0 — feed to the cutter position and partial-cut. Printers without
 * a cutter ignore it but still do the feed, which is what we want.
 */
export function cut(): number[] {
  return [GS, 0x56, 66, 0];
}

/**
 * Printable ASCII only. Thermal printers ship in code page 437 or a vendor
 * variant, and no two agree on what byte 0x9C is; the peso sign in
 * particular is nowhere reliable. The receipt builder writes "P" instead,
 * and this is the last line of defence so a stray peso sign or accent never
 * becomes a multi-byte UTF-8 sequence the printer renders as wrong glyphs.
 */
export function toAscii(text: string): number[] {
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? REPLACEMENT;
    out.push(code >= 0x20 && code <= 0x7e ? code : REPLACEMENT);
  }
  return out;
}

export function textLine(text: string): number[] {
  return [...toAscii(text), LF];
}

/** GS ( k — the QR command family shares this prefix; pL/pH is the payload length. */
function qrCommand(payload: number[]): number[] {
  const length = payload.length + 1; // the cn byte (49) counts toward pL/pH
  return [GS, 0x28, 0x6b, length & 0xff, (length >> 8) & 0xff, 49, ...payload];
}

/**
 * Model 2, module size 1..16, error correction M, store, print.
 *
 * The printer holds the symbol in its own buffer between store and print,
 * so the sequence must go out in this order and without another QR command
 * in between. Error correction M (49) is the usual choice for paper that
 * will be crumpled in a laundry bag: it survives a 15% loss.
 */
export function qrCode(data: string, moduleSize: number): number[] {
  const size = Math.max(1, Math.min(16, Math.round(moduleSize)));
  return [
    ...qrCommand([65, 50, 0]),
    ...qrCommand([67, size]),
    ...qrCommand([69, 49]),
    ...qrCommand([80, 48, ...toAscii(data)]),
    ...qrCommand([81, 48]),
  ];
}

/**
 * BLE writes carry at most one MTU minus the ATT header, and the cheapest
 * printers never negotiate above 20. Sending the whole receipt in one write
 * silently drops everything past the first packet, so the transport sends it
 * in slices this size.
 */
export function chunkBytes(bytes: number[], size: number): number[][] {
  if (bytes.length === 0) return [];
  if (size <= 0) return [bytes];
  const chunks: number[][] = [];
  for (let at = 0; at < bytes.length; at += size) {
    chunks.push(bytes.slice(at, at + size));
  }
  return chunks;
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * The BLE library takes characteristic values as base64 strings. Hermes has
 * had btoa for a while, but it wants a binary string and throws on anything
 * else; encoding the bytes directly is shorter than converting twice.
 */
export function bytesToBase64(bytes: readonly number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const triple = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += BASE64[(triple >> 18) & 63] + BASE64[(triple >> 12) & 63];
    out += b === undefined ? '=' : BASE64[(triple >> 6) & 63];
    out += c === undefined ? '=' : BASE64[triple & 63];
  }
  return out;
}
