/**
 * The docket on paper.
 *
 * A thermal receipt is a column of fixed-width text, 32 characters on 58mm
 * paper and 48 on 80mm, followed by whatever the printer can draw itself.
 * This module turns an order into that column: a list of lines that say
 * what they are (text with styling, a rule, a feed, a QR, a cut) so the
 * layout can be tested without a printer, and one function that turns the
 * list into ESC/POS bytes for the one that has a printer.
 *
 * The QR at the bottom is the point of the slip. It carries the same
 * `milaundry://order/<id>?token=…` payload the on-screen QR does, so a
 * customer who scans it with the app claims the order onto their dashboard
 * and follows it from there, exactly as if the shop had shown them the
 * phone screen.
 */

import type { OrderWithDetails } from '../api';
import { actualBill } from './actual-bill';
import { docketNumber, stampLabel } from './docket';
import * as esc from './escpos';
import { roundCentavos } from './money';
import type { PrinterPaper, ReceiptHeaderSize, ReceiptTextSize } from './printer';
import { formatQuantity, lineQuantity } from './price-label';
import { appliedReward } from './rewards';
import { buildOrderQr } from './qr';

export type PaperColumns = 24 | 32 | 36 | 42 | 48 | 64;

export const PAPER_COLUMNS = { '58mm': 32, '80mm': 48 } as const satisfies Record<PrinterPaper, PaperColumns>;

/** Font B packs more characters on a line. */
const SMALL_COLUMNS = { '58mm': 42, '80mm': 64 } as const satisfies Record<PrinterPaper, PaperColumns>;

/** A browser has no double-height mode, so its large text is wider letters, fewer to a line. */
const BROWSER_LARGE_COLUMNS = { '58mm': 24, '80mm': 36 } as const satisfies Record<PrinterPaper, PaperColumns>;

/**
 * Characters per line for a paper and a text size. A thermal printer's large
 * text is only taller, so it keeps font A's count; the browser's is not.
 */
export function receiptColumns(
  paper: PrinterPaper,
  size: ReceiptTextSize,
  medium: 'thermal' | 'browser' = 'thermal'
): PaperColumns {
  if (size === 'small') return SMALL_COLUMNS[paper];
  if (size === 'large' && medium === 'browser') return BROWSER_LARGE_COLUMNS[paper];
  return PAPER_COLUMNS[paper];
}

/** `big` is double width and height; `tall` is double height only. */
export type ReceiptLine =
  | { kind: 'text'; text: string; align?: esc.Alignment; bold?: boolean; big?: boolean; tall?: boolean }
  | { kind: 'rule' }
  | { kind: 'feed'; lines: number }
  | { kind: 'qr'; value: string }
  | { kind: 'cut' };

export interface ReceiptShop {
  name: string;
  address?: string | null;
  phone?: string | null;
}

export interface ReceiptOptions {
  columns: PaperColumns;
  headerSize?: ReceiptHeaderSize;
}

/** Pesos as "P1,234.50": the peso glyph is not in any thermal code page we can count on. */
export function moneyPlain(amount: number): string {
  const cents = roundCentavos(amount);
  const [whole, fraction] = cents.toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `P${grouped}.${fraction}`;
}

/** Left text, right text, and enough spaces between for the right to end at the edge. */
export function twoColumn(left: string, right: string, columns: number): string {
  const room = columns - right.length - 1;
  const clipped = left.length > room ? left.slice(0, Math.max(0, room)) : left;
  const gap = Math.max(1, columns - clipped.length - right.length);
  return `${clipped}${' '.repeat(gap)}${right}`;
}

export function centered(text: string, columns: number): string {
  if (text.length >= columns) return text;
  return `${' '.repeat(Math.floor((columns - text.length) / 2))}${text}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** "06 Sep 2026 10:15" in the phone's own zone; the printer has no clock of its own. */
export function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const text = (
  value: string,
  style: Omit<Extract<ReceiptLine, { kind: 'text' }>, 'kind' | 'text'> = {}
): ReceiptLine => ({ kind: 'text', text: value, ...style });

/** The shop name's line at the size chosen in Settings. */
export function headerLine(name: string, size: ReceiptHeaderSize = 'large'): ReceiptLine {
  const sized = size === 'large' ? { big: true } : size === 'medium' ? { tall: true } : {};
  return text(name, { align: 'center', bold: true, ...sized });
}

function header(shop: ReceiptShop, size?: ReceiptHeaderSize): ReceiptLine[] {
  const lines: ReceiptLine[] = [headerLine(shop.name, size)];
  if (shop.address) lines.push(text(shop.address, { align: 'center' }));
  if (shop.phone) lines.push(text(shop.phone, { align: 'center' }));
  return lines;
}

/** `5 kg x 60.00`; a flat line reads as one charge, with its load when it has one. */
function receiptQuantity(item: OrderWithDetails['order_items'][number]): string {
  if (item.unit !== 'flat') return `${formatQuantity(item.unit, item.quantity)} x ${moneyPlain(item.unit_price)}`;
  const load = lineQuantity(item.unit, item.quantity);
  return load ? `${load}, flat rate` : 'Flat rate';
}

function items(order: OrderWithDetails, columns: number): ReceiptLine[] {
  return order.order_items.flatMap((item) => [
    text(twoColumn(item.service_name, moneyPlain(item.subtotal), columns)),
    text(`  ${receiptQuantity(item)}`),
  ]);
}

function totals(order: OrderWithDetails, columns: number): ReceiptLine[] {
  const bill = actualBill(order);
  const label = bill.stage === 'estimated' ? 'ESTIMATED' : 'TOTAL';
  const amount = moneyPlain(order.final_total ?? order.estimated_total);
  // The items add up to the bill before the reward; without its own line the
  // paper would not add up.
  const reward = appliedReward(order);
  // Thermal code pages have neither ₱ nor the middle dot.
  const lines: ReceiptLine[] = reward
    ? [
        text(twoColumn('Reward', `-${moneyPlain(reward.discount)}`, columns)),
        text(`  ${reward.label.replace(/₱/g, 'P').replace(/·/g, '-')}`),
      ]
    : [];
  lines.push(text(twoColumn(label, amount, columns), { bold: true }));
  const stamp = stampLabel(bill.stage);
  if (stamp) lines.push(text(stamp, { align: 'center', bold: true, big: true }));
  return lines;
}

export function buildReceipt(
  order: OrderWithDetails,
  shop: ReceiptShop,
  options: ReceiptOptions
): ReceiptLine[] {
  const { columns, headerSize } = options;
  const when = whenLabel(order.created_at);
  return [
    ...header(shop, headerSize),
    { kind: 'rule' },
    text(`Docket ${docketNumber(order.id)}`, { bold: true, big: true }),
    ...(when ? [text(when)] : []),
    text(order.customer_name),
    ...(order.customer_phone ? [text(order.customer_phone)] : []),
    { kind: 'rule' },
    ...items(order, columns),
    { kind: 'rule' },
    ...totals(order, columns),
    ...(order.notes ? [{ kind: 'rule' } as const, text(`Note: ${order.notes}`)] : []),
    { kind: 'feed', lines: 1 },
    { kind: 'qr', value: buildOrderQr(order.id, order.claim_token) },
    text('Scan with your phone camera', { align: 'center' }),
    text('to follow this order online', { align: 'center' }),
    { kind: 'feed', lines: 3 },
    { kind: 'cut' },
  ];
}

/** Module size 6 on 58mm paper draws a 25mm symbol; 48-column paper has room for more. */
function qrModuleSize(columns: number): number {
  return columns >= 48 ? 8 : 6;
}

/**
 * The size the plain lines print at. Small is a font switch made once at the
 * top; large is double height, which a big line's double size replaces and
 * which has to be put back after it.
 */
function bodySize(size: ReceiptTextSize): number[] {
  return size === 'large' ? esc.tallSize(true) : esc.doubleSize(false);
}

export function receiptToEscPos(
  lines: readonly ReceiptLine[],
  columns: PaperColumns,
  size: ReceiptTextSize = 'normal'
): number[] {
  const out: number[] = [...esc.initialize()];
  if (size === 'small') out.push(...esc.smallFont(true));
  if (size === 'large') out.push(...bodySize(size));
  for (const line of lines) {
    switch (line.kind) {
      case 'text': {
        const where = line.align ?? 'left';
        if (where !== 'left') out.push(...esc.align(where));
        if (line.bold) out.push(...esc.bold(true));
        const isSized = Boolean(line.big || line.tall);
        if (line.big) out.push(...esc.doubleSize(true));
        else if (line.tall) out.push(...esc.tallSize(true));
        out.push(...esc.textLine(line.text));
        if (isSized) out.push(...bodySize(size));
        if (line.bold) out.push(...esc.bold(false));
        if (where !== 'left') out.push(...esc.align('left'));
        break;
      }
      case 'rule':
        out.push(...esc.textLine('-'.repeat(columns)));
        break;
      case 'feed':
        out.push(...esc.feed(line.lines));
        break;
      case 'qr':
        out.push(...esc.align('center'), ...esc.qrCode(line.value, qrModuleSize(columns)), ...esc.align('left'));
        break;
      case 'cut':
        out.push(...esc.cut());
        break;
    }
  }
  return out;
}
