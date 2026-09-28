import {
  STAGE_LIMIT_HOURS,
  STUCK_AFTER_DAYS,
  classify,
  compactAge,
  handOverPrompt,
  queueSections,
  queueStats,
  queueTitle,
  rowAction,
  showsUnpaid,
  statusLine,
  stuckAction,
  type QueueOrder,
} from '../order-queue';

/** Friday 25 Sep 2026, 2:00 PM local. */
const NOW = new Date('2026-09-25T14:00:00');

function order(overrides: Partial<QueueOrder>): QueueOrder {
  return {
    id: '67ae3c66-0000-4000-8000-000000000000',
    status: 'washing',
    payment_status: 'unpaid',
    order_type: 'walk_in',
    fulfillment: 'pickup',
    customer_id: null,
    customer_name: 'Maria Soledad',
    customer_phone: '+639171234567',
    estimated_total: 440,
    final_total: null,
    created_at: '2026-09-25T09:00:00',
    updated_at: '2026-09-25T11:00:00',
    deliver_by: null,
    ...overrides,
  };
}

describe('classify', () => {
  it('gives each stage its own time limit, counted from the last change', () => {
    expect(STAGE_LIMIT_HOURS).toEqual({ pending: 24, received: 24, washing: 12, drying: 12, folded: 24 });
    expect(classify(order({ updated_at: '2026-09-25T03:00:00' }), NOW)).toBe('working');
    expect(classify(order({ updated_at: '2026-09-25T01:00:00' }), NOW)).toBe('overdue');
    expect(classify(order({ status: 'received', updated_at: '2026-09-25T01:00:00' }), NOW)).toBe('working');
  });

  it('is overdue once a promised delivery time has passed', () => {
    expect(classify(order({ deliver_by: '2026-09-25T12:00:00' }), NOW)).toBe('overdue');
    expect(classify(order({ deliver_by: '2026-09-25T17:00:00' }), NOW)).toBe('working');
  });

  it('calls an order stuck after a week with no change, whatever its stage', () => {
    expect(STUCK_AFTER_DAYS).toBe(7);
    for (const status of ['pending', 'washing', 'ready'] as const) {
      expect(classify(order({ status, updated_at: '2026-09-17T09:00:00' }), NOW)).toBe('stuck');
    }
    expect(classify(order({ updated_at: '2026-09-19T09:00:00' }), NOW)).toBe('overdue');
  });

  it('never calls a ready order overdue: it is waiting on the customer', () => {
    expect(classify(order({ status: 'ready', updated_at: '2026-09-22T09:00:00' }), NOW)).toBe('ready');
  });

  it('sorts not started from moving, and leaves finished orders out', () => {
    expect(classify(order({ status: 'pending' }), NOW)).toBe('new');
    expect(classify(order({ status: 'completed' }), NOW)).toBeNull();
    expect(classify(order({ status: 'cancelled' }), NOW)).toBeNull();
  });
});

describe('the queue', () => {
  it('orders the counter by urgency and keeps stuck orders out of it', () => {
    const sections = queueSections(
      [
        order({ id: 'new', status: 'pending' }),
        order({ id: 'washing' }),
        order({ id: 'ready', status: 'ready' }),
        order({ id: 'over', status: 'drying', updated_at: '2026-09-24T09:00:00' }),
        order({ id: 'stuck', updated_at: '2026-09-01T09:00:00' }),
        order({ id: 'done', status: 'completed' }),
      ],
      NOW
    );
    expect(sections.map((s) => [s.key, s.title, s.data.map((o) => o.id)])).toEqual([
      ['overdue', 'Overdue', ['over']],
      ['ready', 'Ready for pickup', ['ready']],
      ['working', 'In the machines', ['washing']],
      ['new', 'Not started', ['new']],
    ]);
  });

  it('can show the stuck orders on their own', () => {
    const sections = queueSections([order({ id: 'stuck', updated_at: '2026-09-01T09:00:00' })], NOW, {
      stuck: true,
    });
    expect(sections.map((s) => [s.key, s.data.map((o) => o.id)])).toEqual([['stuck', ['stuck']]]);
  });

  it('puts whatever hits its limit soonest first, and the longest wait at the counter first', () => {
    const sections = queueSections(
      [
        order({ id: 'w-late', updated_at: '2026-09-25T12:00:00' }),
        order({ id: 'w-soon', updated_at: '2026-09-25T04:00:00' }),
        order({ id: 'due', deliver_by: '2026-09-25T15:00:00' }),
        order({ id: 'r-new', status: 'ready', updated_at: '2026-09-25T13:00:00' }),
        order({ id: 'r-old', status: 'ready', updated_at: '2026-09-24T13:00:00' }),
      ],
      NOW
    );
    expect(sections[0].data.map((o) => o.id)).toEqual(['r-old', 'r-new']);
    expect(sections[1].data.map((o) => o.id)).toEqual(['due', 'w-soon', 'w-late']);
  });

  it('counts each order in one tile only, and the money to collect apart', () => {
    expect(
      queueStats(
        [
          order({ updated_at: '2026-09-24T09:00:00' }),
          order({ status: 'pending' }),
          order({ status: 'washing' }),
          order({ status: 'ready', final_total: 300 }),
          order({ status: 'completed', estimated_total: 100 }),
          order({ status: 'completed', payment_status: 'paid' }),
          order({ updated_at: '2026-09-01T09:00:00' }),
          order({ status: 'cancelled' }),
        ],
        NOW
      )
    ).toEqual({ overdue: 1, inProgress: 2, ready: 1, stuck: 1, toCollect: 400, toCollectCount: 2 });
  });
});

describe('the row action', () => {
  it('names the one step the row button takes, and the stage it lands in', () => {
    expect(rowAction(order({ status: 'pending' }))).toEqual({ kind: 'advance', to: 'received', label: 'Receive' });
    expect(rowAction(order({ status: 'received' }))).toEqual({ kind: 'advance', to: 'washing', label: 'Wash' });
    expect(rowAction(order({ status: 'washing' }))).toEqual({ kind: 'advance', to: 'drying', label: 'Dry' });
    expect(rowAction(order({ status: 'drying' }))).toEqual({ kind: 'advance', to: 'folded', label: 'Fold' });
    expect(rowAction(order({ status: 'folded' }))).toEqual({ kind: 'advance', to: 'ready', label: 'Ready' });
  });

  it('hands over a paid order, and asks for the money first on an unpaid one', () => {
    expect(rowAction(order({ status: 'ready', payment_status: 'paid' }))).toEqual({
      kind: 'advance',
      to: 'completed',
      label: 'Hand over',
    });
    expect(rowAction(order({ status: 'ready' }))).toEqual({ kind: 'collect', label: 'Collect' });
  });

  it('offers nothing once the order is over', () => {
    expect(rowAction(order({ status: 'completed' }))).toBeNull();
    expect(rowAction(order({ status: 'cancelled' }))).toBeNull();
  });

  it('offers a stuck order a phone call, not the next wash step', () => {
    expect(stuckAction(order({}))).toEqual({ kind: 'call', label: 'Call', phone: '+639171234567' });
    expect(stuckAction(order({ customer_phone: '' }))).toBeNull();
  });

  it('asks before a hand-over, which cannot be taken back', () => {
    expect(handOverPrompt(order({ status: 'ready', payment_status: 'paid' }))).toEqual({
      title: 'Hand over to Maria Soledad?',
      message: 'The order moves to Done. This cannot be undone.',
      confirmLabel: 'Hand over',
      dismissLabel: 'Not yet',
    });
  });
});

describe('the row words', () => {
  it('titles an order by name, else the number to ring, else where it came from and its ticket', () => {
    expect(queueTitle(order({}))).toBe('Maria Soledad');
    expect(queueTitle(order({ customer_name: ' ', customer_phone: '09171234567' }))).toBe('09171234567');
    expect(queueTitle(order({ customer_name: '', customer_phone: '' }))).toBe('Walk-in #67ae3c66');
    expect(queueTitle(order({ customer_name: '', customer_phone: '', order_type: 'online' }))).toBe(
      'Online #67ae3c66'
    );
  });

  it('says ages the way a wall clock would', () => {
    expect(compactAge(20_000)).toBe('1m');
    expect(compactAge(45 * 60_000)).toBe('45m');
    expect(compactAge(5 * 3_600_000 + 1)).toBe('5h');
    expect(compactAge(19 * 86_400_000)).toBe('19d');
  });

  it('says the stage and the one time that matters for it', () => {
    expect(statusLine(order({}), NOW)).toEqual({ text: 'Washing for 3h', isOverdue: false });
    expect(statusLine(order({ updated_at: '2026-09-25T00:00:00' }), NOW)).toEqual({
      text: 'Washing for 14h',
      isOverdue: true,
    });
    expect(statusLine(order({ status: 'received', deliver_by: '2026-09-26T17:00:00' }), NOW)).toEqual({
      text: 'Dropped off · due Sep 26, 5:00 PM',
      isOverdue: false,
    });
    expect(statusLine(order({ deliver_by: '2026-09-25T11:00:00' }), NOW)).toEqual({
      text: 'Washing · was due 11:00 AM',
      isOverdue: true,
    });
    expect(statusLine(order({ status: 'pending', updated_at: '2026-09-13T14:00:00' }), NOW)).toEqual({
      text: 'Booked · no change for 12d',
      isOverdue: false,
    });
    expect(statusLine(order({ status: 'completed', updated_at: '2026-09-20T09:00:00' }), NOW)).toEqual({
      text: 'Handed over Sep 20, 9:00 AM',
      isOverdue: false,
    });
  });

  it('flags unpaid only once the laundry is ready to go: paying at pickup is normal', () => {
    expect(showsUnpaid(order({ status: 'washing' }))).toBe(false);
    expect(showsUnpaid(order({ status: 'ready' }))).toBe(true);
    expect(showsUnpaid(order({ status: 'completed' }))).toBe(true);
    expect(showsUnpaid(order({ status: 'ready', payment_status: 'paid' }))).toBe(false);
  });
});
