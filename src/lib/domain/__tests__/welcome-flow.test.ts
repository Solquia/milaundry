import type { SavedAccount } from '../saved-accounts';
import {
  type PendingScan,
  afterAuthRoute,
  authHandoffNote,
  fallbackRouteAfterFailedScan,
  parseSignInMode,
  savedAccountsFor,
  scanProblem,
  scanWelcome,
  signInCopy,
} from '../welcome-flow';

const shop = {
  id: '11111111-2222-4333-8444-555555555555',
  name: 'Sparkle Wash',
  slug: 'sparkle-wash',
  tagline: 'Fresh in a day',
  brand_accent: 2,
};

const shopScan: PendingScan = {
  type: 'shop',
  id: shop.id,
  token: 'tok',
  shop,
};

const orderScan: PendingScan = {
  type: 'order',
  id: '99999999-8888-4777-8666-555555555555',
  token: 'tok',
  shop,
};

describe('parseSignInMode', () => {
  it('reads the owner mode off the query string', () => {
    expect(parseSignInMode('owner')).toBe('owner');
  });

  it('takes the first value when the router repeats a key', () => {
    expect(parseSignInMode(['owner', 'customer'])).toBe('owner');
  });

  it('falls back to the customer mode for anything else', () => {
    expect(parseSignInMode(undefined)).toBe('customer');
    expect(parseSignInMode('')).toBe('customer');
    expect(parseSignInMode('merchant')).toBe('customer');
  });
});

describe('signInCopy', () => {
  it('addresses a customer by the number they sign in with', () => {
    const copy = signInCopy('customer');
    expect(copy.title).toBe('Welcome back');
    expect(copy.fieldLabel).toMatch(/mobile number/i);
    expect(copy.placeholder).toBe('0917 123 4567');
  });

  it('addresses an owner by their shop username', () => {
    const copy = signInCopy('owner');
    expect(copy.title).toBe('Shop sign in');
    expect(copy.fieldLabel).toMatch(/username/i);
    expect(copy.placeholder).toBe('sparkle-wash');
  });
});

describe('savedAccountsFor', () => {
  const phone: SavedAccount = { id: 'p', kind: 'phone', label: '0917 123 4567' };
  const username: SavedAccount = { id: 'u', kind: 'username', label: 'sparkle-wash' };

  it('shows only shop usernames on the owner form', () => {
    expect(savedAccountsFor('owner', [phone, username])).toEqual([username]);
  });

  it('keeps every saved account on the customer form', () => {
    // A merchant who came in the front door still finds their chip.
    expect(savedAccountsFor('customer', [phone, username])).toEqual([phone, username]);
  });
});

describe('scanWelcome', () => {
  it('greets a shop scan with the shop ready for the customer', () => {
    const welcome = scanWelcome(shopScan);
    expect(welcome.heading).toBe('Sparkle Wash is ready for you');
    expect(welcome.primary).toBe('Create account & connect');
    expect(welcome.secondary).toBe('I have an account');
  });

  it('greets an order scan as the load waiting at the shop', () => {
    const welcome = scanWelcome(orderScan);
    expect(welcome.heading).toBe('Your load at Sparkle Wash');
    expect(welcome.body).toMatch(/claim/i);
    expect(welcome.primary).toBe('Create account & claim');
  });
});

describe('authHandoffNote', () => {
  it('says nothing when nothing was scanned', () => {
    expect(authHandoffNote(null)).toBeNull();
  });

  it('promises the connection for a shop scan', () => {
    expect(authHandoffNote(shopScan)).toBe(
      "We'll connect you to Sparkle Wash the moment you're in."
    );
  });

  it('promises the claim for an order scan', () => {
    expect(authHandoffNote(orderScan)).toBe(
      "We'll claim your load at Sparkle Wash the moment you're in."
    );
  });
});

describe('afterAuthRoute', () => {
  it('goes home when there is nothing to finish', () => {
    expect(afterAuthRoute(null, 0)).toBe('/');
  });

  it('lands on the shopfront carrying the pre-join count for the welcome', () => {
    expect(afterAuthRoute(shopScan, 0)).toBe(`/(customer)/shop/${shop.id}?welcome=0`);
    expect(afterAuthRoute(shopScan, 3)).toBe(`/(customer)/shop/${shop.id}?welcome=3`);
  });

  // A false "your first laundry" is worse than no welcome, so a count that
  // cannot be trusted drops the param instead of guessing.
  it('drops the welcome when the prior count is unusable', () => {
    expect(afterAuthRoute(shopScan, Number.NaN)).toBe(`/(customer)/shop/${shop.id}`);
    expect(afterAuthRoute(shopScan, -1)).toBe(`/(customer)/shop/${shop.id}`);
    expect(afterAuthRoute(shopScan, 1.5)).toBe(`/(customer)/shop/${shop.id}`);
  });

  it('lands on the order for an order scan', () => {
    expect(afterAuthRoute(orderScan, 0)).toBe(`/(customer)/order/${orderScan.id}`);
  });
});

describe('fallbackRouteAfterFailedScan', () => {
  it('still opens the shopfront, where the connect control lives', () => {
    expect(fallbackRouteAfterFailedScan(shopScan)).toBe(`/(customer)/shop/${shop.id}`);
  });

  it('goes home for an order that could not be claimed', () => {
    expect(fallbackRouteAfterFailedScan(orderScan)).toBe('/');
  });
});

describe('scanProblem', () => {
  it('names each way a scan can go wrong without blaming the customer', () => {
    expect(scanProblem('not-ours')).toMatch(/MiLaundry code/);
    expect(scanProblem('inactive')).toMatch(/fresh one/);
    expect(scanProblem('network')).toMatch(/try again/i);
  });
});
