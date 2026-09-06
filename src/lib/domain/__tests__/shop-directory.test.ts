import { emptyDirectoryMessage, friendlyDirectoryError } from '../shop-directory';

describe('emptyDirectoryMessage', () => {
  it('says nothing once the customer has a shop of their own', () => {
    expect(emptyDirectoryMessage(1)).toBeNull();
    expect(emptyDirectoryMessage(2)).toBeNull();
  });

  it('sends a new customer to the counter, never to a list', () => {
    // Other laundries are not shown here any more; the QR at the counter is
    // the only way in, so the sentence must not promise shops "below" or
    // claim that none are listed.
    const message = emptyDirectoryMessage(0);
    expect(message).toContain('QR');
    expect(message).toMatch(/counter/i);
    expect(message).not.toMatch(/below|listed/i);
  });
});

describe('friendlyDirectoryError', () => {
  it('keeps a sentence the customer can already act on', () => {
    expect(friendlyDirectoryError('connect', 'This shop is not accepting new customers.')).toBe(
      'This shop is not accepting new customers.'
    );
  });

  it('names the lost connection rather than the database', () => {
    expect(friendlyDirectoryError('load', 'TypeError: Network request failed')).toMatch(
      /internet|connection/i
    );
  });

  it('replaces Postgres detail with what did not happen', () => {
    const message = friendlyDirectoryError(
      'connect',
      'duplicate key value violates unique constraint "customer_shops_pkey"'
    );
    expect(message).not.toMatch(/constraint|duplicate key/i);
    expect(message.length).toBeGreaterThan(0);
  });

  it('tells the customer which thing failed', () => {
    // "Something went wrong" on both leaves them unable to tell a dead shop
    // list from a shop that would not take them.
    const load = friendlyDirectoryError('load', '{"code":"PGRST202"}');
    const connect = friendlyDirectoryError('connect', '{"code":"PGRST202"}');
    expect(load).not.toBe(connect);
  });

  it('falls back rather than rendering an empty error', () => {
    expect(friendlyDirectoryError('load', '   ').length).toBeGreaterThan(0);
  });
});
