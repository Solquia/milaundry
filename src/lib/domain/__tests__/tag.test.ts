import type { OrderWithDetails } from '../../api';
import { parseTagCode } from '../qr';
import type { ReceiptLine } from '../receipt';
import { MAX_TAGS, buildTags, clampTagCount } from '../tag';

// The tag goes on the bag, not in the customer's hand. These tests pin what
// the counter needs to read off it (whose load, how to call them, which bag of
// how many) and the one thing it must never carry: the claim token.

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
  claim_token: 'secret-claim-token',
  claimed_at: null,
  notes: '',
  created_at: '2026-09-06T02:15:00.000Z',
  shop: null,
  order_items: [
    { id: 'i1', order_id: 'o', service_id: 's1', created_at: '2026-09-06T02:15:00.000Z', service_name: 'Wash & Fold', unit: 'per_kg', unit_price: 50, quantity: 5, subtotal: 250 },
  ],
};

const shop = { name: 'Sud Buds Laundry' };

const texts = (lines: readonly ReceiptLine[]) =>
  lines.flatMap((line) => (line.kind === 'text' ? [line.text] : []));

const qrs = (lines: readonly ReceiptLine[]) =>
  lines.flatMap((line) => (line.kind === 'qr' ? [line.value] : []));

describe('buildTags', () => {
  it('prints the docket, the customer name and their phone', () => {
    const all = texts(buildTags(order, shop, { columns: 32, count: 1 })).join('\n');
    expect(all).toContain('5B4A');
    expect(all).toContain('Maria Santos');
    expect(all).toContain('09171234567');
  });

  it('prints the name big and bold so it reads across the counter', () => {
    const lines = buildTags(order, shop, { columns: 32, count: 1 });
    const name = lines.find((line) => line.kind === 'text' && line.text === 'Maria Santos');
    expect(name).toMatchObject({ bold: true, big: true });
  });

  it('carries no price, because the bag is not the bill', () => {
    const all = texts(buildTags(order, shop, { columns: 32, count: 1 })).join('\n');
    expect(all).not.toMatch(/P\d/);
    expect(all).not.toMatch(/total/i);
  });

  it('puts a tag QR on it that opens the order and holds no claim token', () => {
    const [qr] = qrs(buildTags(order, shop, { columns: 32, count: 1 }));
    expect(parseTagCode(qr)).toBe(order.id);
    expect(qr).not.toContain('token');
    expect(qr).not.toContain(order.claim_token);
  });

  it('prints one tag per bag, each numbered and each cut off', () => {
    const lines = buildTags(order, shop, { columns: 32, count: 3 });
    const all = texts(lines).join('\n');
    expect(all).toContain('Tag 1/3');
    expect(all).toContain('Tag 2/3');
    expect(all).toContain('Tag 3/3');
    expect(lines.filter((line) => line.kind === 'cut')).toHaveLength(3);
    expect(qrs(lines)).toHaveLength(3);
  });

  it('leaves the phone line out rather than printing an empty one', () => {
    const lines = buildTags({ ...order, customer_phone: '' }, shop, { columns: 32, count: 1 });
    expect(texts(lines).some((text) => text.trim() === '')).toBe(false);
  });

  it('clips a long name to the double-width column so it never wraps', () => {
    const long = { ...order, customer_name: 'Maria Concepcion Dela Cruz Santos' };
    const lines = buildTags(long, shop, { columns: 32, count: 1 });
    const name = lines.find((line) => line.kind === 'text' && line.big && line.text.startsWith('Maria'));
    expect(name && name.kind === 'text' ? name.text.length : 0).toBeLessThanOrEqual(16);
  });

  it('keeps every plain line inside the paper width', () => {
    const lines = buildTags(order, shop, { columns: 32, count: 2 });
    for (const line of lines) {
      if (line.kind !== 'text') continue;
      expect(line.text.length).toBeLessThanOrEqual(line.big ? 16 : 32);
    }
  });
});

describe('clampTagCount', () => {
  it('prints at least one tag and never a runaway roll', () => {
    expect(clampTagCount(0)).toBe(1);
    expect(clampTagCount(-4)).toBe(1);
    expect(clampTagCount(Number.NaN)).toBe(1);
    expect(clampTagCount(2.7)).toBe(2);
    expect(clampTagCount(500)).toBe(MAX_TAGS);
  });
});
