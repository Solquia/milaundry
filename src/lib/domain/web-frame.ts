/**
 * How the app sits in a browser window.
 *
 * The screens are drawn for a phone. Stretched across a desktop window the
 * buttons ran the full width of the monitor and the tab bar's icons sat a
 * metre apart. On the web the app is held to a phone-width column in the
 * middle of the window instead, on the same deep navy the splash opens on,
 * so it looks like the app and not like a stretched copy of it. A narrow
 * window — a phone's browser — is left alone.
 *
 * The public pages are the exception: they are not the app in a browser, they
 * are web pages, and they answer the window themselves.
 */

export const FRAME_MAX_WIDTH = 480;

export interface FrameLayout {
  isFramed: boolean;
  width: number;
}

/**
 * The public pages that draw their own web layout.
 *
 * A shop's storefront, its booking flow, an order's tracking page and the
 * links that connect an account are reached from a QR code, a text message or
 * a search result — often on a laptop, by someone who has never opened the
 * app. They lay themselves out from the viewport (see `web-layout.ts`), so
 * framing them to a phone column would cap a 1440px screen at 480 and throw
 * away the layout they already know how to draw.
 */
const OWN_LAYOUT_PREFIXES = ['/s/', '/track/', '/claim/', '/join/'] as const;

export function hasOwnWebLayout(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  // A trailing slash lets one rule match both `/s/acme` and `/s/acme/book`,
  // while still refusing a route that merely starts with the same letters.
  const path = pathname.endsWith('/') ? pathname : `${pathname}/`;
  return OWN_LAYOUT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function frameLayout(input: {
  platform: string;
  viewportWidth: number;
  /** The address on screen. A page with its own web layout is never framed. */
  pathname?: string | null;
}): FrameLayout {
  if (
    input.platform !== 'web' ||
    input.viewportWidth <= FRAME_MAX_WIDTH ||
    hasOwnWebLayout(input.pathname)
  ) {
    return { isFramed: false, width: input.viewportWidth };
  }
  return { isFramed: true, width: FRAME_MAX_WIDTH };
}
