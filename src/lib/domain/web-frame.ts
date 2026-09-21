/**
 * How this product sits in a browser window.
 *
 * The app's own screens were drawn for a phone. Stretched across a desktop
 * window the buttons ran the full width of the monitor and the tab bar's
 * icons sat a metre apart, so those screens stay in a phone-width column on
 * the same deep navy the splash opens on.
 *
 * A shop's public page is a different surface. A customer opens `/s/<slug>`
 * from a QR code, a text, or a search result, on whatever they are holding —
 * a small Android, a large iPhone, a tablet, a laptop. Capping that page at
 * a phone column left a navy strip either side of a squeezed price grid, so
 * those routes take the window they were opened in and answer it through
 * `web-layout.ts`.
 */

/**
 * The column, in CSS pixels: the widest phone anyone is likely to hold, so
 * the app is never asked to draw a size a real phone never gives it.
 */
export const FRAME_MAX_WIDTH = 430;

/**
 * Public shop pages that own their layout instead of sitting in the phone
 * column. Trailing-slash prefixes so `/s/sparkle` matches and `/settings`
 * does not.
 */
const OWN_LAYOUT_PREFIXES = ['/s/', '/track/', '/claim/', '/join/'] as const;

/** True when this address is a shop's public page, not the app. */
export function hasOwnWebLayout(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return OWN_LAYOUT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export interface FrameLayout {
  /** True when the window is wider than a phone and the backdrop is drawn. */
  isFramed: boolean;
  /** The width the page should lay itself out in — never the window's. */
  width: number;
}

export function frameLayout(input: {
  platform: string;
  viewportWidth: number;
  /** The address on screen. Public shop pages take the whole window. */
  pathname?: string | null;
}): FrameLayout {
  // `!(w > FRAME)` rather than `w <= FRAME`: an unmeasured width arrives as 0
  // or NaN, and NaN fails both comparisons. Not framing is the safe answer —
  // it is what a phone gets, and it fits every window.
  if (input.platform !== 'web' || !(input.viewportWidth > FRAME_MAX_WIDTH)) {
    return { isFramed: false, width: input.viewportWidth };
  }
  if (hasOwnWebLayout(input.pathname)) {
    return { isFramed: false, width: input.viewportWidth };
  }
  return { isFramed: true, width: FRAME_MAX_WIDTH };
}
