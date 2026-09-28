import { isHeldForPayment, settleAmountNote, settleStep, type SettleableOrder } from '../order-settlement';

const base: SettleableOrder = {
  order_type: 'online',
  customer_id: 'cust-1',
  status: 'received',
  payment_status: 'unpaid',
  payment_method: 'gcash',
  final_total: null,
  payment_proof_path: null,
  order_items: [{ unit: 'per_kg' }],
};

const at = (patch: Partial<SettleableOrder>): SettleableOrder => ({ ...base, ...patch });

describe('settleStep', () => {
  it('asks for the laundry before anything can be weighed', () => {
    expect(settleStep(at({ status: 'pending' }))).toBe('receive');
  });

  it('asks for the actual price once a by-weight load is in the shop', () => {
    expect(settleStep(base)).toBe('confirm_price');
    expect(settleStep(at({ status: 'washing' }))).toBe('confirm_price');
  });

  it('asks for the actual price of an online booking sold by the piece, too', () => {
    expect(settleStep(at({ order_items: [{ unit: 'flat' }, { unit: 'per_item' }] }))).toBe('confirm_price');
  });

  it('prices a walk-in by the piece at the counter, with no check to send', () => {
    expect(
      settleStep(at({ order_type: 'walk_in', customer_id: null, order_items: [{ unit: 'flat' }] }))
    ).toBe('collect');
  });

  it('waits on the customer once the price has been sent', () => {
    expect(settleStep(at({ final_total: 180 }))).toBe('await_customer');
  });

  it('asks the shop to check a receipt the customer sent', () => {
    expect(settleStep(at({ final_total: 180, payment_proof_path: 'p/1.jpg' }))).toBe('check_receipt');
  });

  it('collects at the counter when the customer pays cash', () => {
    expect(settleStep(at({ final_total: 180, payment_method: 'cash' }))).toBe('collect');
  });

  it('collects at the counter for a walk-in nobody has claimed', () => {
    expect(settleStep(at({ order_type: 'walk_in', customer_id: null, final_total: 180 }))).toBe('collect');
  });

  it('collects in cash once a piece-priced online order has its price', () => {
    expect(settleStep(at({ order_items: [{ unit: 'per_item' }], payment_method: 'cash', final_total: 90 }))).toBe(
      'collect'
    );
  });

  it('is settled once paid and void once cancelled', () => {
    expect(settleStep(at({ payment_status: 'paid' }))).toBe('settled');
    expect(settleStep(at({ status: 'cancelled' }))).toBe('void');
  });
});

describe('isHeldForPayment', () => {
  it('holds an online load out of the machines until the price is sent', () => {
    expect(isHeldForPayment(base)).toBe(true);
    expect(isHeldForPayment(at({ order_items: [{ unit: 'flat' }] }))).toBe(true);
  });

  it('keeps holding it while the customer pays and the shop checks the receipt', () => {
    expect(isHeldForPayment(at({ final_total: 180 }))).toBe(true);
    expect(isHeldForPayment(at({ final_total: 180, payment_proof_path: 'r.jpg' }))).toBe(true);
  });

  it('lets it into the machines once the shop confirms the money', () => {
    expect(isHeldForPayment(at({ final_total: 180, payment_status: 'paid' }))).toBe(false);
  });

  it('lets a pay-on-delivery order wash once it has its price', () => {
    expect(isHeldForPayment(at({ final_total: 180, payment_method: 'cash' }))).toBe(false);
    expect(isHeldForPayment(at({ payment_method: 'cash' }))).toBe(true);
  });

  it('never holds a walk-in or a booking still on its way', () => {
    expect(isHeldForPayment(at({ order_type: 'walk_in' }))).toBe(false);
    expect(isHeldForPayment(at({ status: 'pending' }))).toBe(false);
  });
});

describe('settleAmountNote', () => {
  it('never calls an unweighed estimate money to collect', () => {
    expect(settleAmountNote(base)).toEqual({ text: 'Estimate · confirm the actual price', isOwed: false });
    expect(settleAmountNote(at({ status: 'pending' }))).toEqual({
      text: 'Estimate · check on arrival',
      isOwed: false,
    });
  });

  it('says who the money is waiting on once the price is real', () => {
    expect(settleAmountNote(at({ final_total: 180 }))).toEqual({ text: 'Final · customer to pay', isOwed: true });
    expect(settleAmountNote(at({ final_total: 180, payment_proof_path: 'x' })).text).toBe('Final · receipt to check');
    expect(settleAmountNote(at({ final_total: 180, payment_method: 'cash' })).text).toBe('Final · to collect');
  });

  it('closes out paid and cancelled orders', () => {
    expect(settleAmountNote(at({ payment_status: 'paid', final_total: 180 }))).toEqual({
      text: 'Final · paid',
      isOwed: false,
    });
    expect(settleAmountNote(at({ status: 'cancelled' })).text).toBe('Cancelled');
  });
});
