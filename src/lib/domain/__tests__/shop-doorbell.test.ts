import {
  doorbellBanner,
  doorbellCard,
  doorbellChannels,
  doorbellHeadline,
  nextDoorbell,
  parseDoorbellEnabled,
  testDoorbellChime,
  type DoorbellOrder,
} from '../shop-doorbell';

function order(overrides: Partial<DoorbellOrder> = {}): DoorbellOrder {
  return {
    id: 'o1',
    order_type: 'online',
    status: 'pending',
    customer_name: 'Maria Santos',
    ...overrides,
  };
}

describe('parseDoorbellEnabled', () => {
  it('starts a new phone ringing', () => {
    expect(parseDoorbellEnabled(null)).toBe(true);
  });

  it('keeps a phone that was silenced, silenced', () => {
    expect(parseDoorbellEnabled('false')).toBe(false);
    expect(parseDoorbellEnabled(JSON.stringify(false))).toBe(false);
  });

  it('keeps a phone that was ringing, ringing', () => {
    expect(parseDoorbellEnabled('true')).toBe(true);
    expect(parseDoorbellEnabled(JSON.stringify(true))).toBe(true);
  });

  it('falls back to ringing rather than throwing on unreadable storage', () => {
    expect(parseDoorbellEnabled('{not json')).toBe(true);
    expect(parseDoorbellEnabled('yes')).toBe(true);
  });
});

describe('nextDoorbell', () => {
  it('stays quiet on the first look, even if the shop already has orders', () => {
    const next = nextDoorbell(null, [order(), order({ id: 'o2' })], true);

    expect(next.chimes).toEqual([]);
    expect([...next.seen].sort()).toEqual(['o1', 'o2']);
  });

  it('rings for a new online booking the shop has not seen', () => {
    const next = nextDoorbell(new Set(['o1']), [order(), order({ id: 'o2' })], true);

    expect(next.chimes).toHaveLength(1);
    expect(next.chimes[0].orderId).toBe('o2');
    expect(next.chimes[0].title).toBe('New order');
    expect(next.chimes[0].body).toContain('Maria');
    expect([...next.seen].sort()).toEqual(['o1', 'o2']);
  });

  it('does not ring for a walk-in the counter just took', () => {
    const next = nextDoorbell(
      new Set(),
      [order({ order_type: 'walk_in', customer_name: 'Walk-in' })],
      true
    );

    expect(next.chimes).toEqual([]);
    expect([...next.seen]).toEqual(['o1']);
  });

  it('does not ring for a cancelled row that appeared between looks', () => {
    const next = nextDoorbell(new Set(), [order({ status: 'cancelled' })], true);

    expect(next.chimes).toEqual([]);
  });

  it('stays quiet when the bell is off, and still marks the order seen', () => {
    const next = nextDoorbell(new Set(), [order({ id: 'fresh' })], false);

    expect(next.chimes).toEqual([]);
    expect([...next.seen]).toEqual(['fresh']);
  });

  it('does not ring again for an order it has already announced', () => {
    const next = nextDoorbell(new Set(['o1']), [order()], true);

    expect(next.chimes).toEqual([]);
  });

  it('says Someone when the booking arrived without a name', () => {
    const next = nextDoorbell(new Set(), [order({ customer_name: '  ' })], true);

    expect(next.chimes[0].body).toBe('Someone booked online.');
  });
});

describe('doorbellHeadline', () => {
  it('is silent when nothing arrived', () => {
    expect(doorbellHeadline([])).toBeNull();
  });

  it('names one booking in the customer\'s words', () => {
    const notice = doorbellHeadline(nextDoorbell(new Set(), [order()], true).chimes);

    expect(notice?.title).toBe('New order');
    expect(notice?.body).toBe('Maria Santos booked online.');
    expect(notice?.orderId).toBe('o1');
  });

  it('counts two bookings rather than stacking two banners', () => {
    const notice = doorbellHeadline(
      nextDoorbell(
        new Set(),
        [order(), order({ id: 'o2', customer_name: 'Juan' })],
        true
      ).chimes
    );

    expect(notice?.title).toBe('2 new orders');
    expect(notice?.body).toBe('Maria Santos and 1 other booked online.');
    expect(notice?.orderId).toBe('o1');
  });

  it('pluralises when more than one other booking lands with it', () => {
    const notice = doorbellHeadline(
      nextDoorbell(
        new Set(),
        [order(), order({ id: 'o2' }), order({ id: 'o3' })],
        true
      ).chimes
    );

    expect(notice?.title).toBe('3 new orders');
    expect(notice?.body).toBe('Maria Santos and 2 others booked online.');
  });
});

describe('doorbellChannels', () => {
  it('rings, taps, and banners while the shop is looking at the app', () => {
    expect(doorbellChannels(true)).toEqual({
      playSound: true,
      haptic: true,
      banner: true,
      systemNotice: false,
    });
  });

  it('also posts a system notice when the app is in the background', () => {
    expect(doorbellChannels(false).systemNotice).toBe(true);
  });
});

describe('testDoorbellChime', () => {
  it('is a ring the shop can hear without a customer placing an order', () => {
    const chime = testDoorbellChime();

    expect(chime.orderId).toBe('test');
    expect(chime.title).toBe('Test ring');
    expect(chime.body).toContain('new order');
  });
});

describe('doorbellCard', () => {
  it('says the phone rings, and offers a way to hear it now', () => {
    const card = doorbellCard(true);

    expect(card.title).toBe('New-order bell');
    expect(card.caption).toContain('rings');
    expect(card.testLabel).toBe('Ring the shop');
    expect(card.rangCaption).toContain('Rang');
  });

  it('says the shop is quiet when the bell is off', () => {
    expect(doorbellCard(false).caption).toContain('quiet');
  });
});

describe('doorbellBanner', () => {
  it('opens the order the chime is about', () => {
    const banner = doorbellBanner({
      orderId: 'o1',
      title: 'New order',
      body: 'Maria Santos booked online.',
    });

    expect(banner.actionLabel).toBe('Open');
    expect(banner.orderId).toBe('o1');
  });
});
