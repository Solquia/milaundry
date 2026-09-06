import {
  PAPER_COLUMNS,
  moneyPlain,
  twoColumn,
  centered,
  buildReceipt,
  receiptToEscPos,
  type ReceiptLine,
} from '../receipt';
import { ESC, GS } from '../escpos';
import type { OrderWithDetails } from '../../api';

// A receipt is the merchant's promise on paper. These tests pin the
// layout (what goes where on 32 and 48 columns) and the one thing that
// makes the slip useful to the customer: the claim QR at the bottom.

const order: OrderWithDetails = {
  id: 'a1b2c3d4-0000-4000-8000-9f8e7d6c5b4a',
  shop_id: 'shop-1',
  customer_id: null,
  created_by: 'staff-1',
  delivery_address: '',
  weigh_photo_path: null,
  weighed_at: null,
  payment_proof_path: null,
  payment_reference: null,
  updated_at: '2026-09-06T02:15:00.000Z',
  status: 'received',
  order_type: 'walk_in',
  fulfillment: 'pickup',
  customer_name: 'Maria Santos',
  customer_phone: '09171234567',
  payment_method: 'cash',
  payment_status: 'unpaid',
  paid_at: null,
  pickup_at: null,
  deliver_by: null,
  estimated_total: 350,
  final_total: null,
  actual_weight_kg: null,
  claim_token: 'tok/en+1',
  claimed_at: null,
  notes: 'No fabric softener',
  created_at: '2026-09-06T02:15:00.000Z',
  shop: null,
  order_items: [
    { id: 'i1', order_id: 'o', service_id: 's1', created_at: '2026-09-06T02:15:00.000Z', service_name: 'Wash & Fold', unit: 'per_kg', unit_price: 50, quantity: 5, subtotal: 250 },
    { id: 'i2', order_id: 'o', service_id: 's2', created_at: '2026-09-06T02:15:00.000Z', service_name: 'Comforter (single)', unit: 'per_item', unit_price: 100, quantity: 1, subtotal: 100 },
  ],
};

const shop = { name: 'Sud Buds Laundry', address: '12 Rizal St, Makati', phone: '09181112222' };

describe('paper widths', () => {
  it('knows the two common thermal widths', () => {
    expect(PAPER_COLUMNS['58mm']).toBe(32);
    expect(PAPER_COLUMNS['80mm']).toBe(48);
  });
});

describe('moneyPlain', () => {
  it('formats pesos without the ₱ glyph, which thermal code pages cannot print', () => {
    expect(moneyPlain(1234.5)).toBe('P1,234.50');
    expect(moneyPlain(0)).toBe('P0.00');
  });
});

describe('twoColumn', () => {
  it('pads the gap so the right side ends at the paper edge', () => {
    const line = twoColumn('Wash', 'P50.00', 32);
    expect(line).toHaveLength(32);
    expect(line.startsWith('Wash')).toBe(true);
    expect(line.endsWith('P50.00')).toBe(true);
  });

  it('truncates a long left column rather than wrapping past the edge', () => {
    const line = twoColumn('A very very long service name indeed', 'P1,000.00', 32);
    expect(line).toHaveLength(32);
    expect(line.endsWith(' P1,000.00')).toBe(true);
  });
});

describe('centered', () => {
  it('centres short text and leaves long text untouched', () => {
    expect(centered('Hi', 6)).toBe('  Hi');
    expect(centered('Toolongforthis', 6)).toBe('Toolongforthis');
  });
});

describe('buildReceipt', () => {
  const lines = buildReceipt(order, shop, { columns: 32 });
  const texts = lines.filter((l): l is Extract<ReceiptLine, { kind: 'text' }> => l.kind === 'text').map((l) => l.text);

  it('opens with the shop name in bold, big, centred', () => {
    const head = lines[0];
    expect(head).toEqual({ kind: 'text', text: 'Sud Buds Laundry', align: 'center', bold: true, big: true });
  });

  it('prints the shop address and phone under the name', () => {
    expect(texts).toContain('12 Rizal St, Makati');
    expect(texts).toContain('09181112222');
  });

  it('shows the six-character docket and the customer', () => {
    expect(texts).toContain('Docket 6C5B4A');
    expect(texts).toContain('Maria Santos');
  });

  it('lists each item with quantity, unit and a right-aligned subtotal', () => {
    expect(texts.some((t) => t.startsWith('Wash & Fold') && t.endsWith('P250.00'))).toBe(true);
    expect(texts).toContain('  5 kg x P50.00');
    expect(texts.some((t) => t.startsWith('Comforter (single)') && t.endsWith('P100.00'))).toBe(true);
  });

  it('labels an unweighed order as an estimate and gives it no stamp', () => {
    // House rule from docket.ts: an estimate has no authority behind it, so
    // nothing is struck across the slip until the shop has weighed the load.
    expect(texts.some((t) => t.startsWith('ESTIMATED') && t.endsWith('P350.00'))).toBe(true);
    expect(texts).not.toContain('TO PAY');
    expect(texts).not.toContain('PAID');
  });

  it('stamps TO PAY once the load is weighed but not yet paid', () => {
    const weighed = buildReceipt({ ...order, final_total: 372.5 }, shop, { columns: 32 });
    const t = weighed.filter((l) => l.kind === 'text').map((l) => (l as { text: string }).text);
    expect(t.some((x) => x.startsWith('TOTAL') && x.endsWith('P372.50'))).toBe(true);
    expect(t).toContain('TO PAY');
  });

  it('keeps the customer notes on the slip', () => {
    expect(texts).toContain('Note: No fabric softener');
  });

  it('ends with the claim QR, an instruction, and a cut', () => {
    const qr = lines.find((l) => l.kind === 'qr');
    expect(qr).toEqual({ kind: 'qr', value: 'milaundry://order/a1b2c3d4-0000-4000-8000-9f8e7d6c5b4a?token=tok%2Fen%2B1' });
    const qrIndex = lines.indexOf(qr!);
    const after = lines.slice(qrIndex + 1);
    expect(after.some((l) => l.kind === 'text' && /scan/i.test(l.text))).toBe(true);
    expect(after[after.length - 1]).toEqual({ kind: 'cut' });
  });

  it('prefers the final total and stamps PAID once payment is recorded', () => {
    const paid = buildReceipt({ ...order, final_total: 372.5, payment_status: 'paid' }, shop, { columns: 32 });
    const t = paid.filter((l) => l.kind === 'text').map((l) => (l as { text: string }).text);
    expect(t.some((x) => x.startsWith('TOTAL') && x.endsWith('P372.50'))).toBe(true);
    expect(t).toContain('PAID');
    expect(t).not.toContain('TO PAY');
  });

  it('widens every rule and column to 48 on 80mm paper', () => {
    const wide = buildReceipt(order, shop, { columns: 48 });
    const rule = wide.find((l) => l.kind === 'rule');
    expect(rule).toBeDefined();
    const total = wide.find((l) => l.kind === 'text' && l.text.startsWith('ESTIMATED')) as { text: string };
    expect(total.text).toHaveLength(48);
  });

  it('skips address and phone lines the shop has not filled in', () => {
    const bare = buildReceipt(order, { name: 'X', address: null, phone: null }, { columns: 32 });
    const t = bare.filter((l) => l.kind === 'text').map((l) => (l as { text: string }).text);
    expect(t).not.toContain('');
    expect(t[0]).toBe('X');
  });
});

describe('receiptToEscPos', () => {
  it('starts with initialize and renders each line kind to bytes', () => {
    const lines: ReceiptLine[] = [
      { kind: 'text', text: 'Hi', align: 'center', bold: true, big: true },
      { kind: 'rule' },
      { kind: 'feed', lines: 2 },
      { kind: 'qr', value: 'abc' },
      { kind: 'cut' },
    ];
    const bytes = receiptToEscPos(lines, 32);
    expect(bytes.slice(0, 2)).toEqual([ESC, 0x40]);
    // Center, bold on, big on, "Hi\n", big off, bold off, back to left.
    expect(bytes.slice(2, 5)).toEqual([ESC, 0x61, 1]);
    expect(bytes).toEqual(expect.arrayContaining([72, 105, 0x0a]));
    // A rule is a full row of dashes.
    const dashes = bytes.filter((b) => b === 45).length;
    expect(dashes).toBe(32);
    expect(bytes.slice(-4)).toEqual([GS, 0x56, 66, 0]);
  });
});
