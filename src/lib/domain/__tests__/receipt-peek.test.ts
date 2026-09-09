import { receiptAmount, receiptLineLabel } from '../receipt-peek';

describe('receiptAmount', () => {
  it('quotes the final total once the shop has weighed the load', () => {
    expect(receiptAmount({ estimated_total: 352, final_total: 410 })).toEqual({
      amount: 410,
      label: 'Total',
      isEstimate: false,
    });
  });

  it('quotes the estimate while the load is still unweighed', () => {
    // Saying "₱352.00" flat on a load nobody has put on the scale is a promise
    // the shop has not made. The word is the whole point of the line.
    expect(receiptAmount({ estimated_total: 352, final_total: null })).toEqual({
      amount: 352,
      label: 'Estimate',
      isEstimate: true,
    });
  });

  it('prefers a final total of zero over an estimate, because zero is an answer', () => {
    // A load settled at nothing — a redo, a goodwill wash — is priced, not
    // unpriced, and `final_total ?? estimate` would quietly bill the estimate.
    expect(receiptAmount({ estimated_total: 352, final_total: 0 })).toEqual({
      amount: 0,
      label: 'Total',
      isEstimate: false,
    });
  });

  it('has no figure at all for a load nothing has been priced on yet', () => {
    expect(receiptAmount({ estimated_total: null, final_total: null })).toEqual({
      amount: null,
      label: 'Estimate',
      isEstimate: true,
    });
  });
});

describe('receiptLineLabel', () => {
  it('says the amount in the unit the shop charges in', () => {
    expect(receiptLineLabel({ service_name: 'Wash & Fold', unit: 'per_kg', quantity: 8 })).toBe(
      'Wash & Fold · 8 kg'
    );
  });

  it('counts pieces as pieces', () => {
    expect(receiptLineLabel({ service_name: 'Ironing', unit: 'per_item', quantity: 3 })).toBe(
      'Ironing · 3 pieces'
    );
  });

  it('leaves a flat charge without a quantity, because one is not a count', () => {
    expect(receiptLineLabel({ service_name: 'Pickup fee', unit: 'flat', quantity: 1 })).toBe(
      'Pickup fee'
    );
  });
});
