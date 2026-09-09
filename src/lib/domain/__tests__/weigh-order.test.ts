import {
  MAX_SCALE_KG,
  canWeigh,
  describeWeighChange,
  parseWeight,
  recomputeForWeight,
  type WeighLine,
} from '../weigh-order';

/** A 5 kg-minimum wash-and-fold plus a per-item comforter, as booked. */
const LINES: WeighLine[] = [
  {
    serviceId: 'wash',
    serviceName: 'Wash & fold',
    unit: 'per_kg',
    unitPrice: 60,
    minQuantity: 5,
    quantity: 5,
  },
  {
    serviceId: 'comforter',
    serviceName: 'Comforter',
    unit: 'per_item',
    unitPrice: 150,
    minQuantity: 0,
    quantity: 1,
  },
];

describe('parseWeight', () => {
  it('reads a plain decimal off the scale', () => {
    expect(parseWeight('7.5')).toBe(7.5);
  });

  it('tolerates the unit the owner types after the number', () => {
    expect(parseWeight('7.5 kg')).toBe(7.5);
  });

  it('rejects a zero or negative reading rather than billing nothing', () => {
    expect(parseWeight('0')).toBeNull();
    expect(parseWeight('-3')).toBeNull();
  });

  it('rejects anything that is not a number', () => {
    expect(parseWeight('')).toBeNull();
    expect(parseWeight('heavy')).toBeNull();
  });

  it('rejects a reading past what a shop scale can hold', () => {
    // Guards a slipped decimal point: 705 instead of 70.5 would otherwise
    // bill the customer for a load no laundry could physically take in.
    expect(parseWeight(String(MAX_SCALE_KG + 1))).toBeNull();
    expect(parseWeight(String(MAX_SCALE_KG))).toBe(MAX_SCALE_KG);
  });
});

describe('recomputeForWeight', () => {
  it('prices the weighed line off the scale, not off the booking', () => {
    const bill = recomputeForWeight(LINES, 'wash', 8);

    const wash = bill.lines.find((line) => line.serviceId === 'wash');
    expect(wash?.quantity).toBe(8);
    expect(wash?.subtotal).toBe(480); // 8 kg × ₱60
  });

  it('leaves per-item extras exactly as the customer booked them', () => {
    // The shop weighs the load, not the comforter. Re-pricing an extra the
    // customer explicitly chose would be changing their order behind them.
    const bill = recomputeForWeight(LINES, 'wash', 8);

    const comforter = bill.lines.find((line) => line.serviceId === 'comforter');
    expect(comforter?.quantity).toBe(1);
    expect(comforter?.subtotal).toBe(150);
  });

  it('totals the weighed line and the untouched extras together', () => {
    expect(recomputeForWeight(LINES, 'wash', 8).total).toBe(630); // 480 + 150
  });

  it('bills a light load at the shop minimum', () => {
    const bill = recomputeForWeight(LINES, 'wash', 3);

    expect(bill.lines.find((line) => line.serviceId === 'wash')?.subtotal).toBe(300);
    expect(bill.isAtMinimum).toBe(true);
  });

  it('does not claim the minimum applied when the load clears it', () => {
    expect(recomputeForWeight(LINES, 'wash', 8).isAtMinimum).toBe(false);
  });

  it('marks which line the scale reading was applied to', () => {
    const bill = recomputeForWeight(LINES, 'wash', 8);

    expect(bill.lines.find((line) => line.serviceId === 'wash')?.isWeighed).toBe(true);
    expect(bill.lines.find((line) => line.serviceId === 'comforter')?.isWeighed).toBe(
      false
    );
  });

  it('rounds to centavos so a receipt never carries float drift', () => {
    const lines: WeighLine[] = [
      {
        serviceId: 'wash',
        serviceName: 'Wash & fold',
        unit: 'per_kg',
        unitPrice: 60.1,
        minQuantity: 0,
        quantity: 1,
      },
    ];

    expect(recomputeForWeight(lines, 'wash', 3.3).total).toBe(198.33);
  });

  it('throws when asked to weigh a line the order does not have', () => {
    expect(() => recomputeForWeight(LINES, 'ghost', 8)).toThrow(/ghost/);
  });

  it('throws when the named line is not sold by weight', () => {
    // A flat or per-item service has no scale reading to take, so silently
    // multiplying its price by kilos would invent a charge.
    expect(() => recomputeForWeight(LINES, 'comforter', 8)).toThrow(/weight/i);
  });
});

describe('describeWeighChange', () => {
  it('says nothing when the scale agreed with the estimate', () => {
    expect(describeWeighChange(630, 630)).toBeNull();
  });

  it('names the increase and warns that the customer sees it', () => {
    expect(describeWeighChange(630, 690)).toBe(
      '₱60.00 more than the ₱630.00 estimate. The customer will see this.'
    );
  });

  it('names a decrease the same way', () => {
    expect(describeWeighChange(630, 570)).toBe(
      '₱60.00 less than the ₱630.00 estimate. The customer will see this.'
    );
  });

  it('ignores a sub-centavo difference rather than reporting ₱0.00 more', () => {
    expect(describeWeighChange(630, 630.001)).toBeNull();
  });
});

describe('canWeigh', () => {
  it('lets the shop weigh a load it has received', () => {
    expect(
      canWeigh({ status: 'received', payment_status: 'unpaid', final_total: null })
    ).toBe(true);
  });

  it('lets the shop correct a weight it already took', () => {
    // Re-weighing before money changes hands is a fix, not a price change.
    expect(
      canWeigh({ status: 'washing', payment_status: 'unpaid', final_total: 630 })
    ).toBe(true);
  });

  it('refuses before the laundry is physically in the shop', () => {
    expect(
      canWeigh({ status: 'pending', payment_status: 'unpaid', final_total: null })
    ).toBe(false);
  });

  it('refuses once the customer has paid', () => {
    // The whole point of the guard: nobody raises a bill after it is settled.
    expect(
      canWeigh({ status: 'ready', payment_status: 'paid', final_total: 630 })
    ).toBe(false);
  });

  it('refuses on a cancelled order', () => {
    expect(
      canWeigh({ status: 'cancelled', payment_status: 'unpaid', final_total: null })
    ).toBe(false);
  });
});
