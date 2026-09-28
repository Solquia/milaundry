/**
 * Closing the day: count the drawer, see if it is right, print or send the
 * day's numbers.
 *
 * The drawer should hold the opening float plus every cash payment taken
 * today. Anything else is over or short, and the report says by exactly how
 * much, because "the drawer was off" is not something an owner can act on.
 * GCash, Maya and the rest never touch the drawer, so they are listed but not
 * counted.
 */
import { formatMoney, roundCentavos } from './money';
import { PAPER_COLUMNS, centered, moneyPlain, twoColumn, type ReceiptLine } from './receipt';
import { clockTime } from './sales-period';
import type { PaymentMethod } from './walk-in-order';

export interface DaySummary {
  /** "Mon 28 Sep". */
  caption: string;
  sales: number;
  payments: number;
  ordersTaken: number;
  methods: readonly { key: PaymentMethod; label: string; amount: number }[];
  /** Everything still owed, ready or not. */
  toCollect: number;
}

export type DrawerTone = 'even' | 'over' | 'short';

export interface DrawerClose {
  float: number;
  counted: number;
  cashSales: number;
  expected: number;
  /** Counted minus expected: negative is short. */
  difference: number;
  tone: DrawerTone;
}

export function closeDay(summary: DaySummary, count: { float: number; counted: number }): DrawerClose {
  const cashSales = summary.methods.find((method) => method.key === 'cash')?.amount ?? 0;
  const expected = roundCentavos(count.float + cashSales);
  const difference = roundCentavos(count.counted - expected);
  return {
    float: count.float,
    counted: count.counted,
    cashSales,
    expected,
    difference,
    tone: Math.abs(difference) < 0.005 ? 'even' : difference > 0 ? 'over' : 'short',
  };
}

/** Pesos as typed at a counter: "3,440.50", "₱ 200". Null for anything else. */
export function parseCount(text: string): number | null {
  const cleaned = text.replace(/[₱,\s]/g, '').replace(/^P/i, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Number(cleaned);
}

const TONE_WORDS: Record<DrawerTone, string> = { even: 'EVEN', over: 'OVER', short: 'SHORT' };

function signedPlain(amount: number): string {
  if (Math.abs(amount) < 0.005) return moneyPlain(0);
  return `${amount < 0 ? '-' : '+'}${moneyPlain(Math.abs(amount))}`;
}

export function zReportLines(
  summary: DaySummary,
  close: DrawerClose,
  shop: { name: string },
  columns: (typeof PAPER_COLUMNS)[keyof typeof PAPER_COLUMNS],
  at: Date
): ReceiptLine[] {
  const row = (left: string, right: string): ReceiptLine => ({ kind: 'text', text: twoColumn(left, right, columns) });
  return [
    { kind: 'text', text: centered(shop.name.slice(0, columns), columns), bold: true },
    { kind: 'text', text: centered('Z-REPORT', columns), bold: true },
    { kind: 'text', text: centered(`${summary.caption} - ${clockTime(at)}`, columns) },
    { kind: 'rule' },
    row('Sales', moneyPlain(summary.sales)),
    row('Payments', String(summary.payments)),
    row('Orders taken', String(summary.ordersTaken)),
    { kind: 'rule' },
    { kind: 'text', text: 'BY METHOD', bold: true },
    ...summary.methods.map((method) => row(method.label, moneyPlain(method.amount))),
    { kind: 'rule' },
    { kind: 'text', text: 'CASH DRAWER', bold: true },
    row('Opening float', moneyPlain(close.float)),
    row('Cash sales', moneyPlain(close.cashSales)),
    row('Expected', moneyPlain(close.expected)),
    row('Counted', moneyPlain(close.counted)),
    { kind: 'text', text: twoColumn(TONE_WORDS[close.tone], signedPlain(close.difference), columns), bold: true },
    { kind: 'rule' },
    row('Still to collect', moneyPlain(summary.toCollect)),
    { kind: 'feed', lines: 3 },
    { kind: 'cut' },
  ];
}

function drawerLine(close: DrawerClose): string {
  if (close.tone === 'even') return 'Drawer even ✅';
  return `Drawer ${close.tone} ${formatMoney(Math.abs(close.difference))}`;
}

/** The message an owner sends a partner at night. */
export function dayCloseShareText(summary: DaySummary, close: DrawerClose, shopName: string): string {
  return [
    `🧺 ${shopName} · ${summary.caption}`,
    `Sales ${formatMoney(summary.sales)} · ${summary.payments} payment${summary.payments === 1 ? '' : 's'}`,
    `Orders taken ${summary.ordersTaken}`,
    ...summary.methods.map((method) => `${method.label} ${formatMoney(method.amount)}`),
    `Still to collect ${formatMoney(summary.toCollect)}`,
    drawerLine(close),
  ].join('\n');
}