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
import { formatQuantity } from './price-label';
import { buildOrderQr } from './qr';

export type PaperColumns = 32 | 48;

export const PAPER_COLUMNS = { '58mm': 32, '80mm': 48 } as const satisfies Record<string, PaperColumns>;

export type ReceiptLine =
  | { kind: 'text'; text: string; align?: esc.Alignment; bold?: boolean; big?: boolean }
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
function whenLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad2(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

const text = (
  value: string,
  style: Omit<Extract<ReceiptLine, { kind: 'text' }>, 'kind' | 'text'> = {}
): ReceiptLine => ({ kind: 'text', text: value, ...style });

function header(shop: ReceiptShop): ReceiptLine[] {
  const lines: ReceiptLine[] = [text(shop.name, { align: 'center', bold: true, big: true })];
  if (shop.address) lines.push(text(shop.address, { align: 'center' }));
  if (shop.phone) lines.push(text(shop.phone, { align: 'center' }));
  return lines;
}

function items(order: OrderWithDetails, columns: number): ReceiptLine[] {
  return order.order_items.flatMap((item) => [
    text(twoColumn(item.service_name, moneyPlain(item.subtotal), columns)),
    text(`  ${formatQuantity(item.unit, item.quantity)} x ${moneyPlain(item.unit_price)}`),
  ]);
}

function totals(order: OrderWithDetails, columns: number): ReceiptLine[] {
  const bill = actualBill(order);
  const label = bill.stage === 'estimated' ? 'ESTIMATED' : 'TOTAL';
  const amount = moneyPlain(order.final_total ?? order.estimated_total);
  const lines: ReceiptLine[] = [text(twoColumn(label, amount, columns), { bold: true })];
  const stamp = stampLabel(bill.stage);
  if (stamp) lines.push(text(stamp, { align: 'center', bold: true, big: true }));
  return lines;
}

export function buildReceipt(
  order: OrderWithDetails,
  shop: ReceiptShop,
  options: ReceiptOptions
): ReceiptLine[] {
  const { columns } = options;
  const when = whenLabel(order.created_at);
  return [
    ...header(shop),
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

export function receiptToEscPos(lines: readonly ReceiptLine[], columns: PaperColumns): number[] {
  const out: number[] = [...esc.initialize()];
  for (const line of lines) {
    switch (line.kind) {
      case 'text': {
        const where = line.align ?? 'left';
        if (where !== 'left') out.push(...esc.align(where));
        if (line.bold) out.push(...esc.bold(true));
        if (line.big) out.push(...esc.doubleSize(true));
        out.push(...esc.textLine(line.text));
        if (line.big) out.push(...esc.doubleSize(false));
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
