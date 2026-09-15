import { claimsToCheck, paymentLedger, type LedgerOrder } from '../payment-ledger';

/**
 * Every field the ledger reads, at its most boring: a booking someone has
 * been priced for and has not paid. Each test bends the one thing it is about.
 */
function order(overrides: Partial<LedgerOrder> = {}): LedgerOrder {
  return {
    id: 'o1',
    order_type: 'online',
    customer_id: 'c1',
    customer_name: 'Maria Santos',
    status: 'ready',
    payment_status: 'unpaid',
    payment_method: 'gcash',
    final_total: 616,
    payment_proof_path: null,
    payment_reference: null,
    paid_at: null,
    updated_at: '2026-09-15T08:00:00Z',
    ...overrides,
  };
}

/** A customer has sent money and uploaded the screenshot. */
const submitted = (overrides: Partial<LedgerOrder> = {}) =>
  order({
    payment_proof_path: 'proof/o1.jpg',
    payment_reference: '9021 3345 7788',
    ...overrides,
  });

describe('paymentLedger', () => {
  it('lists a submitted receipt as something to check', () => {
    const { toCheck } = paymentLedger([submitted()]);

    expect(toCheck.map((claim) => claim.orderId)).toEqual(['o1']);
  });

  it('carries the reference number exactly as the customer typed it', () => {
    // The owner reads this back against their own transaction log by eye, so
    // the grouping spaces are part of the number, not formatting to normalise.
    const { toCheck } = paymentLedger([submitted({ payment_reference: '9021 3345 7788' })]);

    expect(toCheck[0].reference).toBe('9021 3345 7788');
  });

  it('still lists a receipt that came without a reference number', () => {
    // The field is optional on the customer's side. A screenshot alone is
    // still a claim, and dropping it would hide money someone sent.
    const { toCheck } = paymentLedger([submitted({ payment_reference: null })]);

    expect(toCheck).toHaveLength(1);
    expect(toCheck[0].reference).toBeNull();
  });

  it('never calls a claim confirmed just because it has a reference', () => {
    // The app cannot see the shop's balance. Only the shop marking it paid
    // moves a claim out of the queue.
    const { toCheck, confirmed } = paymentLedger([submitted()]);

    expect(confirmed).toHaveLength(0);
    expect(toCheck[0].isConfirmed).toBe(false);
  });

  it('moves a claim to confirmed once the shop has marked it paid', () => {
    const { toCheck, confirmed } = paymentLedger([
      submitted({ payment_status: 'paid', paid_at: '2026-09-15T09:00:00Z' }),
    ]);

    expect(toCheck).toHaveLength(0);
    expect(confirmed.map((claim) => claim.orderId)).toEqual(['o1']);
    expect(confirmed[0].isConfirmed).toBe(true);
  });

  it('keeps a settled cash order in the record', () => {
    // Cash has no reference and no screenshot, but it is still money taken
    // for this order, and a payments list that omitted it would not balance.
    const { confirmed } = paymentLedger([
      order({ payment_method: 'cash', payment_status: 'paid', paid_at: '2026-09-15T09:00:00Z' }),
    ]);

    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].method).toBe('cash');
    expect(confirmed[0].reference).toBeNull();
  });

  it('leaves out orders with nothing to settle yet', () => {
    const ledger = paymentLedger([
      order({ final_total: null }), // not weighed
      order({ id: 'o2' }), // priced, rail chosen, nothing sent
      order({ id: 'o3', payment_method: 'cash' }), // paying at the counter
      order({ id: 'o4', customer_id: null }), // unclaimed walk-in
      order({ id: 'o5', status: 'cancelled' }),
    ]);

    expect(ledger.toCheck).toHaveLength(0);
    expect(ledger.confirmed).toHaveLength(0);
  });

  it('puts the longest-waiting receipt at the top of the queue', () => {
    const ledger = paymentLedger([
      submitted({ id: 'newer', updated_at: '2026-09-15T10:00:00Z' }),
      submitted({ id: 'oldest', updated_at: '2026-09-15T06:00:00Z' }),
      submitted({ id: 'middle', updated_at: '2026-09-15T08:00:00Z' }),
    ]);

    expect(ledger.toCheck.map((claim) => claim.orderId)).toEqual(['oldest', 'middle', 'newer']);
  });

  it('shows the most recently settled payment first', () => {
    const paid = (id: string, at: string) =>
      submitted({ id, payment_status: 'paid' as const, paid_at: at });
    const ledger = paymentLedger([
      paid('older', '2026-09-15T06:00:00Z'),
      paid('newest', '2026-09-15T10:00:00Z'),
      paid('middle', '2026-09-15T08:00:00Z'),
    ]);

    expect(ledger.confirmed.map((claim) => claim.orderId)).toEqual(['newest', 'middle', 'older']);
  });

  it('reports the amount the customer was actually asked for', () => {
    const { toCheck } = paymentLedger([submitted({ final_total: 616 })]);

    expect(toCheck[0].amount).toBe(616);
  });

  it('carries the customer name and the receipt so the row can be checked', () => {
    const { toCheck } = paymentLedger([
      submitted({ customer_name: 'Maria Santos', payment_proof_path: 'proof/o1.jpg' }),
    ]);

    expect(toCheck[0]).toMatchObject({
      customerName: 'Maria Santos',
      proofPath: 'proof/o1.jpg',
      method: 'gcash',
    });
  });

  it('dates a confirmed payment by when it was settled, not when it was sent', () => {
    const { confirmed } = paymentLedger([
      submitted({
        payment_status: 'paid',
        updated_at: '2026-09-15T08:00:00Z',
        paid_at: '2026-09-15T09:30:00Z',
      }),
    ]);

    expect(confirmed[0].at).toBe('2026-09-15T09:30:00Z');
  });

  it('falls back to the last change when a settled order has no paid_at', () => {
    // Older rows predate the column being written.
    const { confirmed } = paymentLedger([
      submitted({ payment_status: 'paid', paid_at: null, updated_at: '2026-09-15T08:00:00Z' }),
    ]);

    expect(confirmed[0].at).toBe('2026-09-15T08:00:00Z');
  });

  it('returns two empty lists for a shop with no orders', () => {
    expect(paymentLedger([])).toEqual({ toCheck: [], confirmed: [] });
  });
});

describe('claimsToCheck', () => {
  it('counts only the receipts still waiting on the shop', () => {
    const count = claimsToCheck([
      submitted({ id: 'a' }),
      submitted({ id: 'b' }),
      submitted({ id: 'c', payment_status: 'paid', paid_at: '2026-09-15T09:00:00Z' }),
      order({ id: 'd' }),
    ]);

    expect(count).toBe(2);
  });

  it('is zero when nothing is waiting', () => {
    expect(claimsToCheck([order()])).toBe(0);
  });
});
