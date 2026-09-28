import {
  BOARD_VIEWS,
  boardCounts,
  boardOrders,
  groupByDay,
  matchesQuery,
  orderCardLabel,
  type BoardOrder,
  type BoardView,
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
    updated_at: '2026-09-06T09:00:00',
    deliver_by: null,
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
  it('offers the views the counter actually switches between', () => {
    expect(BOARD_VIEWS).toEqual(['active', 'overdue', 'working', 'ready', 'stuck', 'collect', 'done', 'all']);
  });

  it('counts each view so the tiles can say how many are behind them', () => {
    expect(boardCounts(ORDERS, NOW)).toEqual({
      active: 3,
      overdue: 0,
      working: 2,
      ready: 1,
      stuck: 0,
      collect: 0,
      done: 2,
      all: 5,
    });
  });

  it('keeps stuck orders out of the live queue and gives them a view of their own', () => {
    const orders = [
      ...ORDERS,
      order({ id: 'stuck', updated_at: '2026-08-20T09:00:00' }),
      order({ id: 'over', updated_at: '2026-09-05T09:00:00' }),
    ];
    const ids = (view: BoardView) => boardOrders(orders, { view, query: '' }, NOW).map((o) => o.id);
    expect(ids('stuck')).toEqual(['stuck']);
    expect(ids('overdue')).toEqual(['over']);
    expect(ids('active')).toEqual(['a', 'b', 'e', 'over']);
  });

  it('filters by view', () => {
    const ids = (view: BoardView) => boardOrders(ORDERS, { view, query: '' }, NOW).map((o) => o.id);
    expect(ids('working')).toEqual(['a', 'e']);
    expect(ids('ready')).toEqual(['b']);
    expect(ids('done')).toEqual(['c', 'd']);
  });

  it('asks for money only on laundry that is ready or gone', () => {
    const orders = [order({ id: 'w' }), order({ id: 'r', status: 'ready' }), order({ id: 'x', status: 'completed' })];
    expect(boardOrders(orders, { view: 'collect', query: '' }, NOW).map((o) => o.id)).toEqual(['r', 'x']);
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
    const found = boardOrders(ORDERS, { view: 'all', query: '#c' }, NOW);
    expect(found.map((o) => o.id)).toEqual(['c']);
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
