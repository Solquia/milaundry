import {
  CUSTOMER_SEGMENTS,
  STANDING_LABELS,
  buildCustomerBook,
  customerInitials,
  customerKey,
  filterCustomers,
  ordersOfCustomer,
  sortCustomers,
  type CustomerOrder,
} from '../customer-insights';
import type { ShopCustomer } from '../../types';

const NOW = new Date('2026-09-06T14:30:00');

function order(overrides: Partial<CustomerOrder>): CustomerOrder {
  return {
    customer_id: null,
    customer_name: 'Maria Soledad',
    customer_phone: '+639171234567',
    status: 'completed',
    payment_status: 'paid',
    estimated_total: 100,
    final_total: null,
    created_at: '2026-09-06T09:00:00',
    order_type: 'walk_in',
    ...overrides,
  };
}

function registered(overrides: Partial<ShopCustomer>): ShopCustomer {
  return {
    customer_id: 'acct-1',
    full_name: 'Jose Rizal',
    phone: '+639170000000',
    registered_at: '2026-08-01T09:00:00',
    order_count: 0,
    total_spend: 0,
    last_order_at: null,
    ...overrides,
  };
}

describe('customer identity', () => {
  it('treats a local and an international spelling of one number as one person', () => {
    expect(customerKey(order({ customer_phone: '+63 917 123 4567' }))).toBe(
      customerKey(order({ customer_phone: '0917-123-4567' }))
    );
  });

  it('prefers the account, then the phone digits, then the name', () => {
    expect(customerKey(order({ customer_id: 'acct-1' }))).toBe('acct:acct-1');
    expect(customerKey(order({ customer_phone: '0917 123 4567' }))).toBe('tel:9171234567');
    expect(customerKey(order({ customer_phone: '', customer_name: '  Ana Cruz ' }))).toBe(
      'name:ana cruz'
    );
  });

  it('has no key for an order with nobody attached', () => {
    expect(customerKey(order({ customer_phone: '', customer_name: '' }))).toBeNull();
  });

  it('initials come from the first and last word', () => {
    expect(customerInitials('Maria Soledad')).toBe('MS');
    expect(customerInitials('Ana')).toBe('A');
    expect(customerInitials('  ')).toBe('?');
  });
});

describe('the customer book', () => {
  it('rolls one person’s orders into lifetime value', () => {
    const book = buildCustomerBook(
      [
        order({ estimated_total: 100, created_at: '2026-07-01T09:00:00' }),
        order({ estimated_total: 250, final_total: 260, created_at: '2026-09-06T09:00:00' }),
        order({
          estimated_total: 80,
          payment_status: 'unpaid',
          created_at: '2026-09-05T09:00:00',
        }),
      ],
      [],
      NOW
    );
    expect(book.customers).toHaveLength(1);
    const [maria] = book.customers;
    expect(maria.name).toBe('Maria Soledad');
    expect(maria.phone).toBe('+639171234567');
    expect(maria.orderCount).toBe(3);
    expect(maria.lifetimeValue).toBe(440);
    expect(maria.paidValue).toBe(360);
    expect(maria.owed).toBe(80);
    expect(maria.averageOrder).toBe(146.67);
    expect(maria.firstOrderAt).toBe('2026-07-01T09:00:00');
    expect(maria.lastOrderAt).toBe('2026-09-06T09:00:00');
  });

  it('ignores cancelled orders entirely', () => {
    const book = buildCustomerBook(
      [order({ status: 'cancelled', estimated_total: 999 }), order({})],
      [],
      NOW
    );
    expect(book.customers[0].orderCount).toBe(1);
    expect(book.customers[0].lifetimeValue).toBe(100);
  });

  it('keeps the most recent name and phone a person gave', () => {
    const book = buildCustomerBook(
      [
        order({ customer_name: 'M. Soledad', created_at: '2026-06-01T09:00:00' }),
        order({ customer_name: 'Maria Soledad', created_at: '2026-09-01T09:00:00' }),
      ],
      [],
      NOW
    );
    expect(book.customers[0].name).toBe('Maria Soledad');
  });

  it('counts anonymous walk-ins without inventing a customer', () => {
    const book = buildCustomerBook(
      [order({ customer_name: '', customer_phone: '' }), order({})],
      [],
      NOW
    );
    expect(book.customers).toHaveLength(1);
    expect(book.anonymousOrders).toBe(1);
  });

  it('lists a registered customer who has not ordered yet as connected', () => {
    const book = buildCustomerBook([], [registered({})], NOW);
    expect(book.customers).toHaveLength(1);
    expect(book.customers[0].standing).toBe('connected');
    expect(book.customers[0].isRegistered).toBe(true);
    expect(book.customers[0].lifetimeValue).toBe(0);
  });

  it('merges a registered customer with the orders on their account', () => {
    const book = buildCustomerBook(
      [order({ customer_id: 'acct-1', customer_name: 'Jose Rizal', customer_phone: '' })],
      [registered({ customer_id: 'acct-1', phone: '+639170000000' })],
      NOW
    );
    expect(book.customers).toHaveLength(1);
    expect(book.customers[0].isRegistered).toBe(true);
    expect(book.customers[0].phone).toBe('+639170000000');
    expect(book.customers[0].orderCount).toBe(1);
  });

  it('grades standing by how often and how recently they come', () => {
    const book = buildCustomerBook(
      [
        // One order, this month: new.
        order({ customer_name: 'New Nina', customer_phone: '1' }),
        // Two orders: returning.
        order({ customer_name: 'Ret Rey', customer_phone: '2', created_at: '2026-08-20T09:00:00' }),
        order({ customer_name: 'Ret Rey', customer_phone: '2' }),
        // Three orders: regular.
        order({ customer_name: 'Reg Rosa', customer_phone: '3', created_at: '2026-08-01T09:00:00' }),
        order({ customer_name: 'Reg Rosa', customer_phone: '3', created_at: '2026-08-15T09:00:00' }),
        order({ customer_name: 'Reg Rosa', customer_phone: '3' }),
        // Last seen 60 days ago: lapsed, however many orders.
        order({ customer_name: 'Lap Leo', customer_phone: '4', created_at: '2026-06-01T09:00:00' }),
        order({ customer_name: 'Lap Leo', customer_phone: '4', created_at: '2026-07-01T09:00:00' }),
      ],
      [],
      NOW
    );
    const standing = Object.fromEntries(book.customers.map((c) => [c.name, c.standing]));
    expect(standing).toEqual({
      'New Nina': 'new',
      'Ret Rey': 'returning',
      'Reg Rosa': 'regular',
      'Lap Leo': 'lapsed',
    });
    expect(STANDING_LABELS.lapsed).toBe('Not seen lately');
  });

  it('summarises the book for the earnings screen', () => {
    const book = buildCustomerBook(
      [
        order({ customer_name: 'A', customer_phone: '1', estimated_total: 100 }),
        order({ customer_name: 'B', customer_phone: '2', estimated_total: 200 }),
        order({ customer_name: 'B', customer_phone: '2', estimated_total: 100 }),
        order({ customer_name: 'C', customer_phone: '3', created_at: '2026-05-01T09:00:00' }),
      ],
      [registered({})],
      NOW
    );
    expect(book.summary).toEqual({
      total: 4,
      ordering: 3,
      repeatRate: 33,
      averageLifetimeValue: 166.67,
      lapsed: 1,
      newThisMonth: 2,
    });
  });
});

describe('sorting and filtering', () => {
  const book = buildCustomerBook(
    [
      order({ customer_name: 'Ana', customer_phone: '111', estimated_total: 50 }),
      order({ customer_name: 'Ben', customer_phone: '222', estimated_total: 900, created_at: '2026-06-01T09:00:00' }),
      order({ customer_name: 'Cai', customer_phone: '333', estimated_total: 200, created_at: '2026-09-01T09:00:00' }),
      order({ customer_name: 'Cai', customer_phone: '333', estimated_total: 100, payment_status: 'unpaid', created_at: '2026-09-05T09:00:00' }),
    ],
    [],
    NOW
  );

  it('sorts by lifetime value, recency, or visits', () => {
    expect(sortCustomers(book.customers, 'value').map((c) => c.name)).toEqual(['Ben', 'Cai', 'Ana']);
    expect(sortCustomers(book.customers, 'recent').map((c) => c.name)).toEqual(['Ana', 'Cai', 'Ben']);
    expect(sortCustomers(book.customers, 'orders').map((c) => c.name)).toEqual(['Cai', 'Ben', 'Ana']);
  });

  it('does not reorder the list it was given', () => {
    const before = book.customers.map((c) => c.name);
    sortCustomers(book.customers, 'value');
    expect(book.customers.map((c) => c.name)).toEqual(before);
  });

  it('filters by segment', () => {
    expect(CUSTOMER_SEGMENTS.map((s) => s.key)).toEqual(['all', 'new', 'regular', 'owing', 'lapsed']);
    expect(filterCustomers(book.customers, 'owing', '').map((c) => c.name)).toEqual(['Cai']);
    expect(filterCustomers(book.customers, 'lapsed', '').map((c) => c.name)).toEqual(['Ben']);
    expect(filterCustomers(book.customers, 'new', '').map((c) => c.name)).toEqual(['Ana']);
  });

  it('searches by name or phone digits', () => {
    expect(filterCustomers(book.customers, 'all', 'ca').map((c) => c.name)).toEqual(['Cai']);
    expect(filterCustomers(book.customers, 'all', '22').map((c) => c.name)).toEqual(['Ben']);
    expect(filterCustomers(book.customers, 'all', 'zzz')).toEqual([]);
  });
});

describe('an account and the walk-ins it made before it had the app', () => {
  const walkIns = [
    order({ customer_name: 'Jose', customer_phone: '0917 000 0000', created_at: '2026-07-01T09:00:00' }),
    order({ customer_name: 'Jose R.', customer_phone: '09170000000', created_at: '2026-08-01T09:00:00' }),
  ];
  const claimed = order({
    customer_id: 'acct-1',
    customer_name: 'Jose R.',
    customer_phone: '09170000000',
    created_at: '2026-09-06T09:00:00',
  });

  it('folds walk-ins on the account’s phone number into the account', () => {
    const book = buildCustomerBook([...walkIns, claimed], [registered({})], NOW);
    expect(book.customers).toHaveLength(1);
    const [jose] = book.customers;
    expect(jose.key).toBe('acct:acct-1');
    expect(jose.isRegistered).toBe(true);
    expect(jose.orderCount).toBe(3);
    expect(jose.keys).toEqual(['acct:acct-1', 'tel:9170000000']);
  });

  it('keeps every order of theirs findable from the profile, cancelled ones included', () => {
    const cancelled = order({ customer_phone: '09170000000', status: 'cancelled', created_at: '2026-08-15T09:00:00' });
    const stranger = order({ customer_name: 'Ana', customer_phone: '0918 111 2222' });
    const all = [...walkIns, cancelled, claimed, stranger];
    const book = buildCustomerBook(all, [registered({})], NOW);
    const jose = book.customers.find((c) => c.key === 'acct:acct-1')!;
    expect(ordersOfCustomer(jose, all)).toEqual([...walkIns, cancelled, claimed]);
  });

  it('does not fold anything into an account with no number', () => {
    const book = buildCustomerBook(walkIns, [registered({ phone: '' })], NOW);
    expect(book.customers).toHaveLength(2);
    const jose = book.customers.find((c) => c.key === 'acct:acct-1')!;
    expect(jose.keys).toEqual(['acct:acct-1']);
  });

  it('gives an unregistered walk-in a single key', () => {
    const book = buildCustomerBook([walkIns[0]], [], NOW);
    expect(book.customers[0].keys).toEqual(['tel:9170000000']);
  });
});
