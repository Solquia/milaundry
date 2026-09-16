/**
 * How this product sits in a browser window.
 *
 * Every screen here — the app's own and the shop pages a customer reaches
 * from a QR code, a text message or a search result — was drawn for a phone,
 * and a phone is what almost everyone opens it on. Stretched across a desktop
 * window the buttons ran the full width of the monitor and the tab bar's icons
 * sat a metre apart; grown into a desktop storefront it became a second design
 * to keep in step with the first, for the smallest share of the traffic.
 *
 * So on the web there is one presentation: a phone-width column in the middle
 * of the window, on the same deep navy the splash opens on. A narrow window —
 * a phone's browser — is simply left to fill itself, which is the same layout
 * without the backdrop around it. One codepath, one thing to get right.
 *
 * The column's width is the only dial. The page inside it reads that width
 * rather than the window's (see `web-layout.ts` and `components/viewport.tsx`),
 * so widening this constant is all it would take to let the pages spread out
 * again — the wider layouts are still there, waiting for a number.
 */

/**
 * The column, in CSS pixels: the widest phone anyone is likely to hold, so
 * the page is never asked to draw a size a real phone never gives it.
 */
export const FRAME_MAX_WIDTH = 430;

export interface FrameLayout {
  /** True when the window is wider than a phone and the backdrop is drawn. */
  isFramed: boolean;
  /** The width the page should lay itself out in — never the window's. */
  width: number;
}

export function frameLayout(input: {
  platform: string;
  viewportWidth: number;
  /**
   * The address on screen. Kept for callers that pass it and for the day a
   * route wants out of the column; no route asks for that today.
   */
  pathname?: string | null;
}): FrameLayout {
  // `!(w > FRAME)` rather than `w <= FRAME`: an unmeasured width arrives as 0
  // or NaN, and NaN fails both comparisons. Not framing is the safe answer —
  // it is what a phone gets, and it fits every window.
  if (input.platform !== 'web' || !(input.viewportWidth > FRAME_MAX_WIDTH)) {
    return { isFramed: false, width: input.viewportWidth };
  }
  return { isFramed: true, width: FRAME_MAX_WIDTH };
}
