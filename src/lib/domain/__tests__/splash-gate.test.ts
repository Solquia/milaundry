import {
  SPLASH_MAX_MS,
  SPLASH_MIN_MS,
  homeRouteForRole,
  openRoute,
  shouldLeaveSplash,
} from '../splash-gate';

describe('openRoute', () => {
  it('opens the app on the splash, before the sign-in form', () => {
    expect(
      openRoute({ isAuthLoading: false, hasSession: false, role: null, hasSeenSplash: false })
    ).toBe('/splash');
  });

  it('shows the splash while the session is still being restored, not a bare spinner', () => {
    expect(
      openRoute({ isAuthLoading: true, hasSession: false, role: null, hasSeenSplash: false })
    ).toBe('/splash');
  });

  it('sends someone who is not signed in to the welcome once the splash is done', () => {
    // Not straight to a form: the first choice is scan, sign in, or create.
    expect(
      openRoute({ isAuthLoading: false, hasSession: false, role: null, hasSeenSplash: true })
    ).toBe('/welcome');
  });

  it('waits rather than guessing a destination while auth is still loading', () => {
    expect(
      openRoute({ isAuthLoading: true, hasSession: true, role: null, hasSeenSplash: true })
    ).toBeNull();
  });

  it('never shows the splash twice in one launch', () => {
    // Returning to the index after signing out must not replay the splash.
    expect(
      openRoute({ isAuthLoading: false, hasSession: false, role: null, hasSeenSplash: true })
    ).not.toBe('/splash');
  });

  it('hands a signed-in merchant to their own dashboard', () => {
    expect(
      openRoute({
        isAuthLoading: false,
        hasSession: true,
        role: 'merchant',
        hasSeenSplash: true,
      })
    ).toBe('/(merchant)/orders');
  });

  it('hands a signed-in customer to the MiLaundry tab', () => {
    expect(
      openRoute({
        isAuthLoading: false,
        hasSession: true,
        role: 'customer',
        hasSeenSplash: true,
      })
    ).toBe('/(customer)/orders');
  });
});

describe('homeRouteForRole', () => {
  it('routes each role to the screen it owns', () => {
    expect(homeRouteForRole('merchant')).toBe('/(merchant)/orders');
    expect(homeRouteForRole('superadmin')).toBe('/(admin)');
    expect(homeRouteForRole('customer')).toBe('/(customer)/orders');
  });

  it('treats a profile that has not arrived yet as a customer', () => {
    // The session exists before the profile row is fetched; the customer tab is
    // the safe landing, since every account can read it.
    expect(homeRouteForRole(null)).toBe('/(customer)/orders');
    expect(homeRouteForRole(undefined)).toBe('/(customer)/orders');
  });
});

describe('shouldLeaveSplash', () => {
  it('holds the splash long enough to be read, not flashed', () => {
    expect(shouldLeaveSplash({ elapsedMs: 0, isAuthLoading: false })).toBe(false);
    expect(shouldLeaveSplash({ elapsedMs: SPLASH_MIN_MS - 1, isAuthLoading: false })).toBe(
      false
    );
  });

  it('leaves once the minimum has passed and the session is known', () => {
    expect(shouldLeaveSplash({ elapsedMs: SPLASH_MIN_MS, isAuthLoading: false })).toBe(true);
  });

  it('keeps waiting while the session check is still running', () => {
    expect(shouldLeaveSplash({ elapsedMs: SPLASH_MIN_MS, isAuthLoading: true })).toBe(false);
  });

  it('never strands anyone on the splash when the session check hangs', () => {
    // A stalled network must cost a wait, not the app.
    expect(shouldLeaveSplash({ elapsedMs: SPLASH_MAX_MS, isAuthLoading: true })).toBe(true);
  });

  it('gives the session a real chance before giving up on it', () => {
    expect(SPLASH_MAX_MS).toBeGreaterThan(SPLASH_MIN_MS);
  });
});
