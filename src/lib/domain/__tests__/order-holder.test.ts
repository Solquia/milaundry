import {
  findHolderAccount,
  holderBookKey,
  holderSummary,
  orderHolder,
  type HeldOrder,
  type HolderAccount,
} from '../order-holder';

const NOW = new Date('2026-09-06T14:30:00');

function order(overrides: Partial<HeldOrder>): HeldOrder {
  return {
    order_type: 'walk_in',
    customer_id: null,
    claimed_at: null,
    customer_phone: '+639171234567',
    ...overrides,
  };
}

const MARIA: HolderAccount = {
  customer_id: 'acct-1',
  full_name: 'Maria Soledad Cruz',
  phone: '+639171234567',
};

describe('who holds an order', () => {
  it('is nobody for a walk-in that no account has claimed', () => {
    expect(orderHolder(order({}))).toEqual({ kind: 'walk_in' });
    expect(holderBookKey(orderHolder(order({})))).toBeNull();
  });

  it('is the claimant for a walk-in an account scanned', () => {
    const holder = orderHolder(
      order({ customer_id: 'acct-1', claimed_at: '2026-09-06T10:15:00' })
    );
    expect(holder).toEqual({ kind: 'claimed', customerId: 'acct-1', claimedAt: '2026-09-06T10:15:00' });
    expect(holderBookKey(holder)).toBe('acct:acct-1');
  });

  it('is the booker for an order placed in the app', () => {
    const holder = orderHolder(order({ order_type: 'online', customer_id: 'acct-1' }));
    expect(holder).toEqual({ kind: 'booked', customerId: 'acct-1' });
    expect(holderBookKey(holder)).toBe('acct:acct-1');
  });
});

describe('the account behind an order', () => {
  it('is found by id in the shop’s customer list', () => {
    expect(findHolderAccount(order({ customer_id: 'acct-1' }), [MARIA])).toBe(MARIA);
  });

  it('is null for a walk-in, or when the list does not carry it', () => {
    expect(findHolderAccount(order({}), [MARIA])).toBeNull();
    expect(findHolderAccount(order({ customer_id: 'acct-9' }), [MARIA])).toBeNull();
  });
});

describe('what the counter reads about the holder', () => {
  it('says nothing for an unclaimed walk-in', () => {
    expect(holderSummary(order({}), null, NOW)).toBeNull();
  });

  it('names the claimant and when they claimed the ticket', () => {
    const summary = holderSummary(
      order({ customer_id: 'acct-1', claimed_at: '2026-09-06T10:15:00' }),
      MARIA,
      NOW
    );
    expect(summary).toEqual({
      name: 'Maria Soledad Cruz',
      isNamed: true,
      detail: 'Claimed this ticket 10:15 AM · has the app',
      otherPhone: null,
    });
  });

  it('dates an older claim', () => {
    const summary = holderSummary(
      order({ customer_id: 'acct-1', claimed_at: '2026-08-24T18:36:00' }),
      MARIA,
      NOW
    );
    expect(summary?.detail).toBe('Claimed this ticket Aug 24, 6:36 PM · has the app');
  });

  it('still says the ticket was claimed when the stamp is missing', () => {
    const summary = holderSummary(order({ customer_id: 'acct-1' }), MARIA, NOW);
    expect(summary?.detail).toBe('Claimed this ticket · has the app');
  });

  it('says an online order was booked in the app', () => {
    const summary = holderSummary(
      order({ order_type: 'online', customer_id: 'acct-1' }),
      MARIA,
      NOW
    );
    expect(summary?.detail).toBe('Booked in the app');
  });

  it('falls back to a stand-in when the account is not in the list yet', () => {
    const summary = holderSummary(order({ customer_id: 'acct-1' }), null, NOW);
    expect(summary?.name).toBe('App customer');
    expect(summary?.isNamed).toBe(false);
  });

  it('treats a blank account name as unnamed', () => {
    const summary = holderSummary(order({ customer_id: 'acct-1' }), { ...MARIA, full_name: '  ' }, NOW);
    expect(summary?.name).toBe('App customer');
    expect(summary?.isNamed).toBe(false);
  });

  it('surfaces the account number only when the ticket carries a different one', () => {
    const differs = holderSummary(
      order({ customer_id: 'acct-1', customer_phone: '0917 999 0000' }),
      MARIA,
      NOW
    );
    expect(differs?.otherPhone).toBe('+639171234567');

    const sameDigits = holderSummary(
      order({ customer_id: 'acct-1', customer_phone: '0917-123-4567' }),
      { ...MARIA, phone: '09171234567' },
      NOW
    );
    expect(sameDigits?.otherPhone).toBeNull();

    const blankOnTicket = holderSummary(
      order({ customer_id: 'acct-1', customer_phone: '' }),
      MARIA,
      NOW
    );
    expect(blankOnTicket?.otherPhone).toBe('+639171234567');
  });
});
