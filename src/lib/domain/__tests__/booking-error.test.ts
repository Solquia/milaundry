import { describeCatalogProblem, friendlyBookingError } from '../booking-error';

describe('describeCatalogProblem', () => {
  it('stays quiet when the service loaded', () => {
    expect(
      describeCatalogProblem({ hasShopId: true, loadError: null, isServiceFound: true })
    ).toBeNull();
  });

  it('blames the connection, not the shop, when the price list fails to load', () => {
    // Previously any network failure rendered "Service not found", telling the
    // customer their laundry service does not exist when the signal dropped.
    const problem = describeCatalogProblem({
      hasShopId: true,
      loadError: new Error('Network request failed'),
      isServiceFound: false,
    });

    expect(problem).toEqual({
      title: "We couldn't load this shop's prices",
      body: 'Check your connection and try again.',
      canRetry: true,
    });
  });

  it('offers a retry for a load failure even if a stale service is still cached', () => {
    const problem = describeCatalogProblem({
      hasShopId: true,
      loadError: new Error('Network request failed'),
      isServiceFound: true,
    });

    expect(problem?.canRetry).toBe(true);
  });

  it('sends the customer back to the shop when there is no shop to price against', () => {
    const problem = describeCatalogProblem({
      hasShopId: false,
      loadError: null,
      isServiceFound: false,
    });

    expect(problem).toEqual({
      title: 'We lost track of the shop',
      body: 'Go back and open the shop again to book this service.',
      canRetry: false,
    });
  });

  it('explains a genuinely missing service without offering a pointless retry', () => {
    const problem = describeCatalogProblem({
      hasShopId: true,
      loadError: null,
      isServiceFound: false,
    });

    expect(problem).toEqual({
      title: 'This service is off the menu right now',
      body: 'The shop may have updated its price list. Go back and pick another service.',
      canRetry: false,
    });
  });
});

describe('friendlyBookingError', () => {
  it('names the connection when the request never reached the shop', () => {
    expect(friendlyBookingError('Network request failed')).toBe(
      "We couldn't reach the shop. Check your connection and try again."
    );
    expect(friendlyBookingError('fetch failed: timeout')).toBe(
      "We couldn't reach the shop. Check your connection and try again."
    );
  });

  it('replaces database detail with something the customer can act on', () => {
    expect(
      friendlyBookingError(
        'new row for relation "orders" violates check constraint "orders_quantity_check"'
      )
    ).toBe("We couldn't place your booking. Please try again.");
    expect(friendlyBookingError('PGRST116: no rows returned')).toBe(
      "We couldn't place your booking. Please try again."
    );
    expect(friendlyBookingError('{"code":500}')).toBe(
      "We couldn't place your booking. Please try again."
    );
  });

  it('falls back when the failure arrives with nothing to say', () => {
    expect(friendlyBookingError('')).toBe(
      "We couldn't place your booking. Please try again."
    );
    expect(friendlyBookingError('   ')).toBe(
      "We couldn't place your booking. Please try again."
    );
  });

  it('hides a missing backend function behind something the customer can act on', () => {
    // A shop whose database is missing the online-booking upgrade answered with
    // the raw PostgREST signature — the customer read a list of SQL parameter
    // names and had no idea the shop simply cannot take bookings yet.
    expect(
      friendlyBookingError(
        'Could not find the function public.place_order(p_customer_id, p_customer_name, ' +
          'p_customer_phone, p_deliver_by, p_delivery_address, p_fulfillment, p_is_paid, ' +
          'p_items, p_notes, p_payment_method, p_pickup_at, p_shop_id) in the schema cache'
      )
    ).toBe(
      "This shop can't take online bookings yet. Please contact the shop to place your order."
    );
  });

  it('treats any missing database object the same way', () => {
    expect(
      friendlyBookingError('Could not find the table public.reviews in the schema cache')
    ).toBe(
      "This shop can't take online bookings yet. Please contact the shop to place your order."
    );
  });

  it('keeps a message that already reads like a sentence to a customer', () => {
    expect(friendlyBookingError('This shop is closed for the day.')).toBe(
      'This shop is closed for the day.'
    );
  });
});

describe('unavailable shops and services', () => {
  const base = { hasShopId: true, loadError: null, isServiceFound: true };

  it('says the shop is not taking bookings, without a pointless retry', () => {
    const problem = describeCatalogProblem({ ...base, isShopAvailable: false });
    expect(problem?.title).toMatch(/isn't taking bookings/i);
    expect(problem?.canRetry).toBe(false);
  });

  it('ranks a closed shop above a missing service', () => {
    const problem = describeCatalogProblem({ ...base, isShopAvailable: false, isServiceFound: false });
    expect(problem?.title).toMatch(/isn't taking bookings/i);
  });

  it('names the service from last time when a rebook finds it gone', () => {
    const problem = describeCatalogProblem({
      ...base,
      isServiceFound: false,
      rebookServiceName: 'Wash & Fold',
    });
    expect(problem?.title).toBe("Wash & Fold isn't offered anymore");
  });

  it('turns server refusals into sentences', () => {
    expect(friendlyBookingError('not registered with this shop')).toMatch(/connect/i);
    expect(friendlyBookingError('unknown service: 1b4e28ba-2fa1-11d2-883f-0016d3cca427')).toMatch(
      /isn't offered/i
    );
    expect(friendlyBookingError('delivery orders need an address')).toBe(
      'Enter the pickup & delivery address.'
    );
  });
});
describe('a rebook whose order will not load', () => {
  const base = { hasShopId: true, loadError: null, isServiceFound: true };

  it('says so and offers a retry instead of a silently blank booking', () => {
    const problem = describeCatalogProblem({ ...base, rebookLoadError: new Error('Failed to fetch') });
    expect(problem?.title).toMatch(/previous order/i);
    expect(problem?.canRetry).toBe(true);
  });

  it('stays quiet when the order loaded', () => {
    expect(describeCatalogProblem({ ...base, rebookLoadError: null })).toBeNull();
  });
});