import type { QrPayload } from './qr';
import type { SavedAccount } from './saved-accounts';

/**
 * The front door.
 *
 * Before anyone is signed in the app has exactly one job: get them to the
 * laundry they are standing in. So the first screen leads with the scan, and
 * the sign-in and create-account forms become the *second* step of a scan
 * rather than the gate in front of it. Everything a guest scans is held here
 * until they are in, then finished for them — nobody should have to find the
 * code twice.
 *
 * This module owns the words and the routes. The screens own the pixels.
 */

/** What the counter's code told us, before the customer has an account. */
export interface ScannedShop {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  brand_accent: number | null;
}

/** A scan waiting for a session. The shop is always known: a code that could
 *  not be looked up is refused at the camera, not carried into the forms. */
export interface PendingScan extends QrPayload {
  shop: ScannedShop;
}

/** Who the sign-in form is talking to. */
export type SignInMode = 'customer' | 'owner';

/** Reads `?as=owner` off the route, tolerating the router's repeated keys. */
export function parseSignInMode(raw: string | string[] | undefined): SignInMode {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === 'owner' ? 'owner' : 'customer';
}

export interface SignInCopy {
  title: string;
  /** Small tracked line above the title; only the owner form needs one. */
  eyebrow: string | null;
  fieldLabel: string;
  placeholder: string;
  /** The line under the form that offers the other path. */
  otherPath: string;
}

/**
 * One form, two voices. The single box still accepts either identity — the
 * parser does not care — but a customer should not be asked for a "username"
 * and an owner should not be shown a phone number they never use.
 */
export function signInCopy(mode: SignInMode): SignInCopy {
  if (mode === 'owner') {
    return {
      title: 'Shop sign in',
      eyebrow: 'FOR LAUNDRY OWNERS & STAFF',
      fieldLabel: 'Shop username',
      placeholder: 'sparkle-wash',
      otherPath: 'Not a shop? Sign in as a customer',
    };
  }
  return {
    title: 'Welcome back',
    eyebrow: null,
    fieldLabel: 'Mobile number',
    placeholder: '0917 123 4567',
    otherPath: 'Run a laundry? Shop sign in',
  };
}

/**
 * Which remembered accounts belong on this form. The owner form shows only
 * shop usernames; the customer form keeps everything, so a merchant who came
 * in the front door still finds their chip.
 */
export function savedAccountsFor(
  mode: SignInMode,
  accounts: readonly SavedAccount[]
): SavedAccount[] {
  if (mode === 'owner') return accounts.filter((account) => account.kind === 'username');
  return [...accounts];
}

export interface ScanWelcome {
  heading: string;
  body: string;
  /** Create an account and finish the scan. */
  primary: string;
  /** Sign in and finish the scan. */
  secondary: string;
}

/** The card that rises when a code is recognised. */
export function scanWelcome(scan: PendingScan): ScanWelcome {
  if (scan.type === 'order') {
    return {
      heading: `Your load at ${scan.shop.name}`,
      body: 'Sign in or create an account to claim it and follow the wash.',
      primary: 'Create account & claim',
      secondary: 'I have an account',
    };
  }
  return {
    heading: `${scan.shop.name} is ready for you`,
    body: 'Create an account to connect, or sign in if you already have one.',
    primary: 'Create account & connect',
    secondary: 'I have an account',
  };
}

/** The promise carried on top of the form, so the scan is not forgotten. */
export function authHandoffNote(scan: PendingScan | null): string | null {
  if (!scan) return null;
  if (scan.type === 'order') {
    return `We'll claim your load at ${scan.shop.name} the moment you're in.`;
  }
  return `We'll connect you to ${scan.shop.name} the moment you're in.`;
}

function isUsableCount(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/**
 * Where a fresh session lands. A finished shop scan carries the pre-join count
 * so the shopfront can stage the connection welcome; a count that cannot be
 * trusted is dropped rather than risk a false "your first laundry".
 */
export function afterAuthRoute(scan: PendingScan | null, priorShopCount: number): string {
  if (!scan) return '/';
  if (scan.type === 'order') return `/(customer)/order/${scan.id}`;
  const base = `/(customer)/shop/${scan.id}`;
  return isUsableCount(priorShopCount) ? `${base}?welcome=${priorShopCount}` : base;
}

/**
 * Where to go when the session was made but the scan could not be finished.
 * The shopfront carries its own connect control, so the customer is one tap
 * from where they were headed; an unclaimable order has nowhere better than
 * home.
 */
export function fallbackRouteAfterFailedScan(scan: PendingScan): string {
  if (scan.type === 'order') return '/';
  return `/(customer)/shop/${scan.id}`;
}

/** How long the camera waits after a bad read before it will read again. */
export const SCAN_RETRY_MS = 1500;

export type ScanProblem = 'not-ours' | 'inactive' | 'network';

export function scanProblem(kind: ScanProblem): string {
  switch (kind) {
    case 'not-ours':
      return "That isn't a MiLaundry code. Look for the one at the counter.";
    case 'inactive':
      return "This code isn't active any more. Ask the shop for a fresh one.";
    case 'network':
      return "We couldn't reach the shop just now. Check your signal and try again.";
  }
}
