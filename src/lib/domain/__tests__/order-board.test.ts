import {
  BOARD_VIEWS,
  SOURCE_OPTIONS,
  boardCounts,
  boardHeadline,
  boardOrders,
  groupByDay,
  matchesQuery,
  orderCardLabel,
  type BoardOrder,
} from '../order-board';

const NOW = new Date('2026-09-06T14:30:00');

function order(overrides: Partial<BoardOrder>): BoardOrder {
  return {
    id: '4b141b63-0000-4000-8000-000000000000',
    status: 'washing',
    payment_status: 'unpaid',
    order_type: 'walk_in',
    fulfillment: 'pickup',
    customer_id: null,
    customer_name: 'Maria Soledad',
    customer_phone: '+639171234567',
    estimated_total: 440,
    final_total: null,
    created_at: '2026-09-06T09:00:00',
    ...overrides,
  };
}

const ORDERS: BoardOrder[] = [
  order({ id: 'a', status: 'washing' }),
  order({ id: 'b', status: 'ready', payment_status: 'paid', order_type: 'online' }),
  order({ id: 'c', status: 'completed', payment_status: 'paid' }),
  order({ id: 'd', status: 'cancelled' }),
  order({ id: 'e', status: 'received', payment_status: 'paid', created_at: '2026-09-05T18:00:00' }),
];

describe('views', () => {
  it('offers the five views the counter actually switches between', () => {
    expect(BOARD_VIEWS.map((v) => v.key)).toEqual(['active', 'ready', 'unpaid', 'done', 'all']);
    expect(SOURCE_OPTIONS.map((s) => s.key)).toEqual(['all', 'walk_in', 'online']);
  });

  it('counts each view so the chips can say how many are behind them', () => {
    expect(boardCounts(ORDERS)).toEqual({ active: 3, ready: 1, unpaid: 1, done: 2, all: 5 });
  });

  it('filters by view', () => {
    expect(boardOrders(ORDERS, { view: 'active', source: 'all', query: '' }).map((o) => o.id)).toEqual(['a', 'b', 'e']);
    expect(boardOrders(ORDERS, { view: 'ready', source: 'all', query: '' }).map((o) => o.id)).toEqual(['b']);
    expect(boardOrders(ORDERS, { view: 'unpaid', source: 'all', query: '' }).map((o) => o.id)).toEqual(['a']);
    expect(boardOrders(ORDERS, { view: 'done', source: 'all', query: '' }).map((o) => o.id)).toEqual(['c', 'd']);
  });

  it('narrows further by where the order came from', () => {
    expect(boardOrders(ORDERS, { view: 'all', source: 'online', query: '' }).map((o) => o.id)).toEqual(['b']);
    expect(boardOrders(ORDERS, { view: 'active', source: 'walk_in', query: '' }).map((o) => o.id)).toEqual(['a', 'e']);
  });
});

describe('search', () => {
  it('matches the name regardless of case', () => {
    expect(matchesQuery(order({}), 'soLEDad')).toBe(true);
    expect(matchesQuery(order({}), 'Rizal')).toBe(false);
  });

  it('matches phone digits however they were typed', () => {
    expect(matchesQuery(order({}), '0917 123')).toBe(true);
    expect(matchesQuery(order({}), '917-1234')).toBe(true);
  });

  it('matches the short order id with or without the hash', () => {
    expect(matchesQuery(order({}), '#4b14')).toBe(true);
    expect(matchesQuery(order({}), '4B141B')).toBe(true);
  });

  it('an empty query matches everything', () => {
    expect(matchesQuery(order({}), '   ')).toBe(true);
  });

  it('search runs across every view', () => {
    const found = boardOrders(ORDERS, { view: 'all', source: 'all', query: '#c' });
    expect(found.map((o) => o.id)).toEqual(['c']);
  });
});

describe('the headline', () => {
  it('says what is in the shop and what is still owed', () => {
    expect(boardHeadline(ORDERS)).toEqual({
      inShop: 3,
      ready: 1,
      toCollect: 440,
      title: '3 in the shop',
      detail: '1 ready for pickup · ₱440.00 to collect',
    });
  });

  it('reads as good news when nothing is pending', () => {
    expect(boardHeadline([order({ status: 'completed', payment_status: 'paid' })])).toEqual({
      inShop: 0,
      ready: 0,
      toCollect: 0,
      title: 'Nothing in the shop',
      detail: 'Everyone has paid',
    });
  });

  it('drops the ready clause when nobody is waiting', () => {
    expect(boardHeadline([order({ status: 'washing' })]).detail).toBe('₱440.00 to collect');
  });
});

describe('grouping by day', () => {
  it('splits the list into today, yesterday, and named days, newest first', () => {
    const groups = groupByDay(
      [
        order({ id: 'today', created_at: '2026-09-06T09:00:00' }),
        order({ id: 'yesterday', created_at: '2026-09-05T18:00:00' }),
        order({ id: 'older', created_at: '2026-09-01T18:00:00' }),
        order({ id: 'today2', created_at: '2026-09-06T11:00:00' }),
      ],
      NOW
    );
    expect(groups.map((g) => g.title)).toEqual(['Today', 'Yesterday', 'Tue 1 Sep']);
    expect(groups[0].data.map((o) => o.id)).toEqual(['today', 'today2']);
  });

  it('is empty for an empty list', () => {
    expect(groupByDay([], NOW)).toEqual([]);
  });
});

describe('the spoken card', () => {
  it('reads out everything the card shows, not just the name and total', () => {
    expect(orderCardLabel(order({}), NOW)).toBe(
      'Maria Soledad, ₱440.00 estimate, unpaid. Washing. Walk-in, pickup. 9:00 AM.'
    );
  });

  it('says paid and drops the estimate word once the bill is final', () => {
    expect(
      orderCardLabel(order({ payment_status: 'paid', final_total: 460, status: 'ready' }), NOW)
    ).toBe('Maria Soledad, ₱460.00, paid. Ready for pickup. Walk-in, pickup. 9:00 AM.');
  });
});

describe('the card label and a claimed ticket', () => {
  it('tells a screen reader the walk-in has an account behind it', () => {
    expect(orderCardLabel(order({ customer_id: 'acct-1' }), NOW)).toBe(
      'Maria Soledad, ₱440.00 estimate, unpaid. Washing. Walk-in, claimed, pickup. 9:00 AM.'
    );
  });

  it('says nothing extra for an online order', () => {
    expect(orderCardLabel(order({ order_type: 'online', customer_id: 'acct-1' }), NOW)).toBe(
      'Maria Soledad, ₱440.00 estimate, unpaid. Washing. Online, pickup. 9:00 AM.'
    );
  });
});
