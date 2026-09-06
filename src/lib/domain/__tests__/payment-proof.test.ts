import {
  customerProofCopy,
  merchantProofCopy,
  proofState,
  validateReference,
  type ProofableOrder,
} from '../payment-proof';

/** An online booking the shop has weighed, to be paid by GCash. */
const WEIGHED: ProofableOrder = {
  order_type: 'online',
  customer_id: 'cust-1',
  status: 'washing',
  payment_status: 'unpaid',
  payment_method: 'gcash',
  final_total: 630,
  payment_proof_path: null,
};

describe('proofState', () => {
  it('has nothing to prove for a walk-in nobody has claimed', () => {
    // Nobody is holding a phone for this ticket; money crosses the counter.
    expect(
      proofState({ ...WEIGHED, order_type: 'walk_in', customer_id: null })
    ).toBe('not_applicable');
  });

  it('lets a claimed walk-in pay from the phone once it is weighed', () => {
    // The receipt was scanned into an account: the same bill, the same rails.
    expect(proofState({ ...WEIGHED, order_type: 'walk_in' })).toBe('awaiting_payment');
    expect(
      proofState({ ...WEIGHED, order_type: 'walk_in', payment_method: 'cash' })
    ).toBe('awaiting_counter');
  });

  it('has nothing to prove once the order is cancelled', () => {
    expect(proofState({ ...WEIGHED, status: 'cancelled' })).toBe('not_applicable');
  });

  it('waits for the price before asking for money', () => {
    expect(proofState({ ...WEIGHED, final_total: null })).toBe('awaiting_price');
  });

  it('sends a cash customer to the counter rather than to an upload', () => {
    expect(proofState({ ...WEIGHED, payment_method: 'cash' })).toBe('awaiting_counter');
  });

  it('asks an online payer to send the money', () => {
    expect(proofState(WEIGHED)).toBe('awaiting_payment');
  });

  it('waits on the shop once a receipt has been uploaded', () => {
    expect(proofState({ ...WEIGHED, payment_proof_path: 'orders/abc/proof.jpg' })).toBe(
      'submitted'
    );
  });

  it('is settled once the shop marks it paid', () => {
    expect(proofState({ ...WEIGHED, payment_status: 'paid' })).toBe('confirmed');
  });

  it('is settled even if no receipt was ever uploaded', () => {
    // A customer who paid at the counter after all still ends up paid. The
    // absence of a screenshot must not reopen a settled bill.
    expect(
      proofState({ ...WEIGHED, payment_status: 'paid', payment_proof_path: null })
    ).toBe('confirmed');
  });
});

describe('customerProofCopy', () => {
  it('explains the wait before the shop has weighed anything', () => {
    const copy = customerProofCopy('awaiting_price', 'Suds & Co');

    expect(copy.title).toBe('Waiting for the actual price');
    expect(copy.canSubmit).toBe(false);
  });

  it('does not ask a cash customer to upload anything', () => {
    const copy = customerProofCopy('awaiting_counter', 'Suds & Co');

    expect(copy.body).toBe('Pay Suds & Co when you hand over or collect your laundry.');
    expect(copy.canSubmit).toBe(false);
  });

  it('asks for the receipt once payment is due', () => {
    const copy = customerProofCopy('awaiting_payment', 'Suds & Co');

    expect(copy.title).toBe('Send your payment');
    expect(copy.canSubmit).toBe(true);
  });

  it('says the shop is checking, and does not ask twice', () => {
    const copy = customerProofCopy('submitted', 'Suds & Co');

    expect(copy.body).toBe('Suds & Co is checking your receipt. This is usually quick.');
    expect(copy.canSubmit).toBe(false);
  });

  it('confirms a settled bill', () => {
    expect(customerProofCopy('confirmed', 'Suds & Co').title).toBe('Paid');
  });
});

describe('merchantProofCopy', () => {
  it('offers no confirm button before a receipt arrives', () => {
    expect(merchantProofCopy('awaiting_payment').canConfirm).toBe(false);
  });

  it('asks the owner to check their own app before confirming', () => {
    // The app records a claim; it cannot see the shop's GCash balance. Saying
    // so is the difference between a record and a false assurance.
    const copy = merchantProofCopy('submitted');

    expect(copy.body).toBe(
      'Check this against your own GCash, Maya, or bank app before confirming.'
    );
    expect(copy.canConfirm).toBe(true);
  });

  it('lets the owner settle a cash bill at the counter', () => {
    expect(merchantProofCopy('awaiting_counter').canConfirm).toBe(true);
  });

  it('offers nothing once the bill is settled', () => {
    expect(merchantProofCopy('confirmed').canConfirm).toBe(false);
  });
});

describe('validateReference', () => {
  it('accepts a GCash reference number', () => {
    expect(validateReference('1234567890123')).toBe('1234567890123');
  });

  it('keeps the spacing a customer copied from their receipt', () => {
    expect(validateReference('  0123 4567 8901  ')).toBe('0123 4567 8901');
  });

  it('accepts a bank reference with letters and dashes', () => {
    expect(validateReference('BPI-2026-0093')).toBe('BPI-2026-0093');
  });

  it('rejects an empty reference', () => {
    expect(validateReference('   ')).toBeNull();
  });

  it('rejects something too short to be a real reference', () => {
    expect(validateReference('12')).toBeNull();
  });

  it('rejects characters no reference number carries', () => {
    // Keeps a pasted URL or a sentence out of a field the shop has to match
    // against their transaction log.
    expect(validateReference('https://evil.example/pay')).toBeNull();
  });
});
