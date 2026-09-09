import { actualBill, type BillableOrder } from '../actual-bill';

const base: BillableOrder = {
  estimated_total: 300,
  final_total: null,
  payment_status: 'unpaid',
  status: 'washing',
  fulfillment: 'pickup',
};

const order = (patch: Partial<BillableOrder> = {}): BillableOrder => ({
  ...base,
  ...patch,
});

describe('actualBill', () => {
  it('calls an unweighed total an estimate, and says so', () => {
    const bill = actualBill(order());

    expect(bill.stage).toBe('estimated');
    expect(bill.heading).toBe('Estimated total');
    expect(bill.amount).toBe('₱300.00');
    expect(bill.note).toContain('weigh');
    // The heading is already "Estimated total". A note that opens by saying
    // the same thing has spent its first sentence on nothing.
    expect(bill.note).not.toContain('This is an estimate');
  });

  it('switches to the actual total once the laundry has been weighed', () => {
    const bill = actualBill(order({ final_total: 340 }));

    expect(bill.stage).toBe('weighed');
    expect(bill.heading).toBe('Actual total');
    expect(bill.amount).toBe('₱340.00');
  });

  it('shows what the weighing changed, so the new figure is not a surprise', () => {
    expect(actualBill(order({ final_total: 340 })).difference).toBe(
      '₱40.00 more than the ₱300.00 estimate'
    );
  });

  it('says so when the load came in lighter than estimated', () => {
    expect(actualBill(order({ final_total: 260 })).difference).toBe(
      '₱40.00 less than the ₱300.00 estimate'
    );
  });

  it('stays quiet when the estimate was exactly right', () => {
    expect(actualBill(order({ final_total: 300 })).difference).toBe(null);
  });

  it('has nothing to compare before the laundry is weighed', () => {
    expect(actualBill(order()).difference).toBe(null);
  });

  it('marks a settled bill as paid and stops asking for money', () => {
    const bill = actualBill(order({ final_total: 340, payment_status: 'paid' }));

    expect(bill.stage).toBe('settled');
    expect(bill.heading).toBe('Paid in full');
    expect(bill.isPayable).toBe(false);
  });

  it('is payable only once there is a real price to pay', () => {
    expect(actualBill(order()).isPayable).toBe(false);
    expect(actualBill(order({ final_total: 340 })).isPayable).toBe(true);
  });

  it('is not payable on a cancelled order, whatever the figures say', () => {
    expect(actualBill(order({ final_total: 340, status: 'cancelled' })).isPayable).toBe(
      false
    );
  });

  it('names where the money changes hands for a pickup', () => {
    expect(actualBill(order({ final_total: 340 })).note).toContain('pick');
  });

  it('names delivery instead when the shop is bringing it over', () => {
    const bill = actualBill(order({ final_total: 340, fulfillment: 'delivery' }));

    expect(bill.note).toContain('deliver');
  });

  it('does not let float drift reach a bill the customer pays', () => {
    // 340.1 - 300.05 is 40.049999... in binary floating point.
    const bill = actualBill(order({ estimated_total: 300.05, final_total: 340.1 }));

    expect(bill.difference).toBe('₱40.05 more than the ₱300.05 estimate');
  });
});
