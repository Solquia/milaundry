/**
 * Where a shop lives on the web, and how the app addresses it.
 *
 * Every laundry gets a public page at `https://<host>/s/<slug>`. The counter
 * code and the receipt code point at that same host, so a phone camera with
 * no app installed opens a page, while the app's scanner reads the same
 * value and connects or claims as it always did.
 *
 * The host is configuration, not code: a deploy to a different domain sets
 * `EXPO_PUBLIC_WEB_HOST`. The default host is kept in the accepted list for
 * good, because codes already printed on receipts and counter cards cannot be
 * reprinted by a config change.
 */

export const DEFAULT_WEB_HOST = 'milaundry.app';

/**
 * The host a person typed into the env, cleaned to a bare host. A scheme, a
 * path, a trailing slash, and letter case are all things a copy-paste carries
 * and none of them belong in a host.
 */
export function normalizeHost(input: string | null | undefined): string | null {
  const trimmed = (input ?? '').trim().toLowerCase();
  if (!trimmed) return null;
  const withoutScheme = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
  const host = withoutScheme.split(/[/?#]/)[0];
  return host.length > 0 ? host : null;
}

/** The host this build publishes links for. */
export function webHost(env: string | undefined = process.env.EXPO_PUBLIC_WEB_HOST): string {
  return normalizeHost(env) ?? DEFAULT_WEB_HOST;
}

/** Every host a scanned code may carry: the configured one, then the default. */
export function acceptedHosts(host: string = webHost()): string[] {
  return host === DEFAULT_WEB_HOST ? [DEFAULT_WEB_HOST] : [host, DEFAULT_WEB_HOST];
}

/** The shop's public page. */
export function storefrontUrl(slug: string, host: string = webHost()): string {
  return `https://${host}/s/${encodeURIComponent(slug)}`;
}

/** The counter code: connects an app account, or opens the shop's page. */
export function joinUrl(shopId: string, token: string, host: string = webHost()): string {
  return `https://${host}/join/${shopId}?token=${encodeURIComponent(token)}`;
}

/** The receipt code: claims the load in the app, or opens it on the web. */
export function claimUrl(orderId: string, token: string, host: string = webHost()): string {
  return `https://${host}/claim/${orderId}?token=${encodeURIComponent(token)}`;
}
