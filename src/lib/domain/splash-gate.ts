/**
 * Where the app goes when it opens, and when the splash is allowed to leave.
 *
 * The splash is not decoration: it is what the session restore happens behind.
 * Without it the app opened on a bare spinner and then snapped to the sign-in
 * form, so the first thing anyone saw was a loading state.
 */

export type Role = 'customer' | 'merchant' | 'superadmin';

export type HomeRoute =
  | '/(customer)/orders'
  | '/(merchant)/orders'
  | '/(admin)';

export type OpenDestination = '/splash' | '/sign-in' | HomeRoute;

/** Long enough to read the wordmark; short enough not to be a toll. */
export const SPLASH_MIN_MS = 1600;

/**
 * The point at which a session check is treated as never arriving. Waiting
 * forever on a stalled network would trap someone on a screen with no controls.
 */
export const SPLASH_MAX_MS = 6000;

/** The screen a signed-in account lands on. */
export function homeRouteForRole(role: Role | null | undefined): HomeRoute {
  if (role === 'merchant') return '/(merchant)/orders';
  if (role === 'superadmin') return '/(admin)';
  // A session exists before its profile row arrives; the customer tab is the
  // safe landing, since every account can read it.
  return '/(customer)/orders';
}

/**
 * The route to send someone to on open, or null while the destination is not
 * yet knowable and the caller should hold.
 */
export function openRoute(input: {
  isAuthLoading: boolean;
  hasSession: boolean;
  role: Role | null | undefined;
  hasSeenSplash: boolean;
}): OpenDestination | null {
  // First, before anything is known — the splash covers the session restore.
  if (!input.hasSeenSplash) return '/splash';

  if (input.isAuthLoading) return null;
  if (!input.hasSession) return '/sign-in';
  return homeRouteForRole(input.role);
}

/** Whether the splash has done its job and can hand over. */
export function shouldLeaveSplash(input: {
  elapsedMs: number;
  isAuthLoading: boolean;
}): boolean {
  if (input.elapsedMs >= SPLASH_MAX_MS) return true;
  if (input.elapsedMs < SPLASH_MIN_MS) return false;
  return !input.isAuthLoading;
}
