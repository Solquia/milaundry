import {
  loadSize,
  moneyLabel,
  ringProgress,
  sortByNext,
  statusWord,
  whenLine,
  type LineOrder,
} from '../laundry-line';

/** Friday 25 Sep 2026, 2 PM in Manila. */
const NOW = new Date('2026-09-25T06:00:00Z');

function order(overrides: Partial<LineOrder> = {}): LineOrder {
  return {
    id: 'o1',
    status: 'washing',
    fulfillment: 'delivery',
    pickup_at: null,
    deliver_by: null,
    estimated_total: 196.61,
    final_total: null,
    payment_status: 'unpaid',
    created_at: '2026-09-25T00:00:00Z',
    order_items: [{ service_name: 'Full Wash and fold', unit: 'per_kg', quantity: 8.5 }],
    ...overrides,
  };
}

describe('loadSize', () => {
  it('says how much, not the whole service name', () => {
    expect(loadSize(order().order_items)).toBe('8.5 kg');
  });

  it('counts the extras in one mark', () => {
    const items = [
      ...order().order_items,
      { service_name: 'Comforter', unit: 'per_item' as const, quantity: 2 },
    ];
    expect(loadSize(items)).toBe('8.5 kg +1');
  });

  it('is empty with nothing itemised', () => {
    expect(loadSize([])).toBe('');
  });
});

describe('whenLine', () => {
  it('says when it is back, in as few words as it takes', () => {
    expect(whenLine(order({ deliver_by: '2026-09-26T10:00:00Z' }), NOW)).toEqual({
      text: 'Back tomorrow 6 PM',
      tone: 'normal',
    });
    expect(whenLine(order({ deliver_by: '2026-10-05T10:00:00Z' }), NOW).text).toBe(
      'Back Mon 5 Oct 6 PM'
    );
  });

  it('owns up when the promise has passed', () => {
    expect(whenLine(order({ deliver_by: '2026-09-24T10:00:00Z' }), NOW)).toEqual({
      text: 'Late · due yesterday 6 PM',
      tone: 'late',
    });
  });

  it('says nothing rather than filler when there is no time to give', () => {
    expect(whenLine(order(), NOW).text).toBe('');
  });

  it('says when the rider arrives with a ready load', () => {
    const ready = order({ status: 'ready', deliver_by: '2026-09-25T10:00:00Z' });
    expect(whenLine(ready, NOW)).toEqual({ text: 'Arrives today 6 PM', tone: 'ready' });
  });

  it('never dates a ready load in the past', () => {
    const stale = order({ status: 'ready', deliver_by: '2026-09-01T02:00:00Z' });
    expect(whenLine(stale, NOW).text).toBe('On its way');
  });

  it('sends a drop-off customer to the counter', () => {
    expect(whenLine(order({ status: 'ready', fulfillment: 'pickup' }), NOW).text).toBe(
      'Collect at the shop'
    );
    expect(whenLine(order({ status: 'pending', fulfillment: 'pickup' }), NOW).text).toBe(
      'Drop off at the shop'
    );
  });

  it('says when the rider comes for a booking', () => {
    const booked = order({ status: 'pending', pickup_at: '2026-09-25T08:00:00Z' });
    expect(whenLine(booked, NOW).text).toBe('Pickup today 4 PM');
  });

  it('closes a finished load in the past tense', () => {
    expect(whenLine(order({ status: 'completed' }), NOW).text).toBe('Delivered');
    expect(whenLine(order({ status: 'completed', fulfillment: 'pickup' }), NOW).text).toBe(
      'Collected'
    );
    expect(whenLine(order({ status: 'cancelled' }), NOW).text).toBe('');
  });
});

describe('statusWord', () => {
  it('uses one short word', () => {
    expect(statusWord('pending')).toBe('Booked');
    expect(statusWord('received')).toBe('In the shop');
    expect(statusWord('ready')).toBe('Ready');
  });
});

describe('ringProgress', () => {
  it('fills the ring a fifth per stage, empty before the shop has it', () => {
    expect(ringProgress('pending')).toBe(0);
    expect(ringProgress('received')).toBeCloseTo(0.2);
    expect(ringProgress('washing')).toBeCloseTo(0.4);
    expect(ringProgress('ready')).toBe(1);
    expect(ringProgress('completed')).toBe(1);
    expect(ringProgress('cancelled')).toBe(0);
  });
});

describe('moneyLabel', () => {
  it('rounds a guess to the peso and marks it as one', () => {
    expect(moneyLabel(order())).toEqual({ text: '~₱197', kind: 'estimate' });
  });

  it('names a weighed bill still owed, and a settled one', () => {
    expect(moneyLabel(order({ final_total: 616 }))).toEqual({ text: '₱616', kind: 'due' });
    expect(moneyLabel(order({ final_total: 616, payment_status: 'paid' }))).toEqual({
      text: '₱616',
      kind: 'paid',
    });
  });
});

describe('sortByNext', () => {
  it('puts what is ready first, then what comes back soonest', () => {
    const late = order({ id: 'late', deliver_by: '2026-09-28T10:00:00Z' });
    const soon = order({ id: 'soon', deliver_by: '2026-09-26T10:00:00Z' });
    const ready = order({ id: 'ready', status: 'ready' });
    const unknown = order({ id: 'unknown' });
    expect(sortByNext([late, unknown, soon, ready]).map((o) => o.id)).toEqual([
      'ready',
      'soon',
      'late',
      'unknown',
    ]);
  });

  it('sinks finished and cancelled loads below everything still moving', () => {
    const done = order({ id: 'done', status: 'completed', deliver_by: '2026-09-20T10:00:00Z' });
    const moving = order({ id: 'moving', deliver_by: '2026-09-28T10:00:00Z' });
    expect(sortByNext([done, moving]).map((o) => o.id)).toEqual(['moving', 'done']);
  });

  it('leaves the list it was given alone', () => {
    const list = [order({ id: 'a' }), order({ id: 'b', status: 'ready' })];
    sortByNext(list);
    expect(list.map((o) => o.id)).toEqual(['a', 'b']);
  });
});
