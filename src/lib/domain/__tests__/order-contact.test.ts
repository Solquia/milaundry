import { orderContact } from '../order-contact';

const online = {
  order_type: 'online' as const,
  customer_id: 'cust-1',
  customer_name: '',
  customer_phone: '',
};

const walkIn = {
  order_type: 'walk_in' as const,
  customer_id: null,
  customer_name: '',
  customer_phone: '',
};

describe('orderContact', () => {
  it('shows the name and number a booking customer signed up with', () => {
    expect(
      orderContact({ ...online, customer_name: 'Ana Cruz', customer_phone: '+639171234567' })
    ).toEqual({ name: 'Ana Cruz', phone: '+639171234567', isNamed: true });
  });

  it('shows the details jotted down for a walk-in', () => {
    expect(
      orderContact({ ...walkIn, customer_name: 'Boy', customer_phone: '09181112222' })
    ).toEqual({ name: 'Boy', phone: '09181112222', isNamed: true });
  });

  it('never calls an online booking a walk-in, even with no name stored', () => {
    expect(orderContact(online)).toEqual({
      name: 'Online customer',
      phone: null,
      isNamed: false,
    });
  });

  it('falls back to walk-in only for an order with no account behind it', () => {
    expect(orderContact(walkIn)).toEqual({
      name: 'Walk-in customer',
      phone: null,
      isNamed: false,
    });
  });

  it('treats whitespace-only details as missing', () => {
    expect(orderContact({ ...walkIn, customer_name: '  ', customer_phone: ' ' })).toEqual({
      name: 'Walk-in customer',
      phone: null,
      isNamed: false,
    });
  });

  it('trims stray spaces off details typed at the counter', () => {
    expect(
      orderContact({ ...walkIn, customer_name: ' Boy ', customer_phone: ' 09181112222 ' })
    ).toEqual({ name: 'Boy', phone: '09181112222', isNamed: true });
  });

  it('keeps a claimed walk-in named after the person who claimed it', () => {
    expect(
      orderContact({ ...walkIn, customer_id: 'cust-9', customer_name: 'Ana Cruz' })
    ).toEqual({ name: 'Ana Cruz', phone: null, isNamed: true });
  });

  it('describes an unnamed order held by an account as a customer, not a walk-in', () => {
    expect(orderContact({ ...walkIn, customer_id: 'cust-9' })).toEqual({
      name: 'App customer',
      phone: null,
      isNamed: false,
    });
  });
});
