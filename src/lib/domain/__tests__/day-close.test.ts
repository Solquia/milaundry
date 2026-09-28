import { closeDay, dayCloseShareText, parseCount, zReportLines, type DaySummary } from '../day-close';

const summary: DaySummary = {
  caption: 'Mon 28 Sep',
  sales: 4860,
  payments: 23,
  ordersTaken: 19,
  methods: [
    { key: 'cash', label: 'Cash', amount: 2940 },
    { key: 'gcash', label: 'GCash', amount: 1920 },
  ],
  toCollect: 1400,
};

describe('closing the day', () => {
  it('expects the float plus the cash taken today', () => {
    const close = closeDay(summary, { float: 500, counted: 3440 });
    expect(close.expected).toBe(3440);
    expect(close.difference).toBe(0);
    expect(close.tone).toBe('even');
  });

  it('calls a drawer short or over by the exact amount', () => {
    expect(closeDay(summary, { float: 500, counted: 3420 })).toMatchObject({ difference: -20, tone: 'short' });
    expect(closeDay(summary, { float: 0, counted: 3000 })).toMatchObject({ difference: 60, tone: 'over' });
  });

  it('reads counted money the way a cashier types it', () => {
    expect(parseCount('3,440.50')).toBe(3440.5);
    expect(parseCount('₱ 200')).toBe(200);
    expect(parseCount('')).toBeNull();
    expect(parseCount('abc')).toBeNull();
    expect(parseCount('-5')).toBeNull();
  });

  it('prints a Z-report that fits the paper', () => {
    const close = closeDay(summary, { float: 500, counted: 3420 });
    const lines = zReportLines(summary, close, { name: 'SmellFresh' }, 32, new Date(2026, 8, 28, 21, 5));
    const texts = lines.flatMap((line) => (line.kind === 'text' ? [line.text] : []));
    expect(texts.every((text) => text.length <= 32)).toBe(true);
    expect(texts.join('\n')).toContain('Z-REPORT');
    expect(texts.join('\n')).toContain('P4,860.00');
    expect(texts.join('\n')).toMatch(/SHORT\s+-P20\.00/);
    expect(lines[lines.length - 1]).toEqual({ kind: 'cut' });
  });

  it('writes a message worth sending to a partner at night', () => {
    const close = closeDay(summary, { float: 500, counted: 3440 });
    const text = dayCloseShareText(summary, close, 'SmellFresh');
    expect(text).toContain('SmellFresh · Mon 28 Sep');
    expect(text).toContain('Sales ₱4,860.00');
    expect(text).toContain('GCash ₱1,920.00');
    expect(text).toContain('Drawer even');
  });
});
