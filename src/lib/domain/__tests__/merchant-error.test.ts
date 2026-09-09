import { friendlyMerchantError } from '../merchant-error';

describe('friendlyMerchantError', () => {
  it('names what failed in words a shop owner uses', () => {
    expect(friendlyMerchantError('load-orders', '')).toBe(
      'Your orders did not load. Try again in a moment.'
    );
    expect(friendlyMerchantError('load-prices', '')).toBe(
      'Your price list did not load. Try again in a moment.'
    );
  });

  it('says it is the connection when it is the connection', () => {
    // The owner can act on this one: move nearer the router, check the signal.
    expect(friendlyMerchantError('load-orders', 'Network request failed')).toBe(
      'No internet connection. Check your signal and try again.'
    );
    expect(friendlyMerchantError('save-payment', 'fetch timeout')).toBe(
      'No internet connection. Check your signal and try again.'
    );
  });

  it('never shows database wording to a shop owner', () => {
    const raw =
      'new row for relation "orders" violates check constraint "orders_status_check"';
    expect(friendlyMerchantError('move-order', raw)).toBe(
      'The order did not move. Try again in a moment.'
    );
    expect(friendlyMerchantError('save-payment', 'PGRST116: no rows returned')).toBe(
      'The payment was not recorded. Try again in a moment.'
    );
    expect(friendlyMerchantError('load-orders', '{"code":500}')).toBe(
      'Your orders did not load. Try again in a moment.'
    );
  });

  it('passes through a message that is already a plain sentence', () => {
    // A rule the shop itself set is worth reading; do not bury it.
    expect(friendlyMerchantError('move-order', 'This order was already cancelled.')).toBe(
      'This order was already cancelled.'
    );
  });

  it('tells a branding failure apart from a price failure', () => {
    // The shopfront card reused 'save-price', so a rejected logo upload told
    // the owner their *price* had not saved — on a screen with no prices on it.
    const rls = 'new row violates row-level security policy';
    expect(friendlyMerchantError('save-branding', rls)).toBe(
      'Your shopfront was not saved. Try again in a moment.'
    );
    expect(friendlyMerchantError('save-branding', rls)).not.toBe(
      friendlyMerchantError('save-price', rls)
    );
  });

  it('tells the owner what to do when their phone cannot be located', () => {
    // Denied permission is not a server fault, so "try again in a moment" is
    // the wrong advice; the fix is in the phone's settings or a tap on the map.
    // The OS's own wording ("Location permission not granted") is neither
    // technical nor helpful, so the card asks for the fallback outright.
    expect(friendlyMerchantError('locate-me', '')).toBe(
      'We could not find your location. Turn on location and try again, or tap the map instead.'
    );
  });

  it('tells a location save apart from a branding save', () => {
    const rls = 'new row violates row-level security policy';
    expect(friendlyMerchantError('save-location', rls)).toBe(
      'Your shop location was not saved. Try again in a moment.'
    );
    expect(friendlyMerchantError('save-cover', rls)).toBe(
      'Your shop photo was not saved. Try again in a moment.'
    );
  });

  it('covers every action with its own sentence', () => {
    const actions = [
      'load-orders',
      'load-prices',
      'load-shop',
      'load-earnings',
      'open-order',
      'save-payment',
      'move-order',
      'save-price',
      'save-branding',
      'save-cover',
      'save-location',
      'locate-me',
    ] as const;
    const messages = actions.map((action) => friendlyMerchantError(action, ''));
    expect(new Set(messages).size).toBe(actions.length);
    messages.forEach((message) => expect(message.endsWith('.')).toBe(true));
  });
});
