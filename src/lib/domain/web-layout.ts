/**
 * How a shop's own web pages answer the window they are opened in.
 *
 * These pages were drawn for a phone and then held to a phone-width column
 * everywhere else, so a customer ordering from a laptop read a 480px strip in
 * the middle of a 1440px monitor: two price cards a row, a hero the size of a
 * postcard, and half the screen doing nothing. The pages are the shop's
 * storefront — the one surface a customer may meet before they ever meet the
 * app — so they take the whole window and change shape with it instead.
 *
 * Four sizes, each earning its own answer rather than interpolating: a phone,
 * a tablet or a split window, a laptop, and a large desktop. The steps are
 * where a layout actually breaks, not round numbers: below 700 there is only
 * room for one column of controls, above 1024 there is room for a second
 * column of supporting material beside the main one, and past 1440 a single
 * column of text would be too long a line to read comfortably, so the content
 * stops growing and the window grows around it.
 */

export type Breakpoint = 'phone' | 'tablet' | 'laptop' | 'desktop';

/** The narrowest viewport that counts as each size. `phone` is everything below. */
export const BREAKPOINTS = { tablet: 700, laptop: 1024, desktop: 1440 } as const;

export interface WebLayout {
  breakpoint: Breakpoint;
  /**
   * The widest the content — main column plus any aside — may grow. A phone
   * gets its whole viewport; past that the content is centred in the window.
   */
  contentWidth: number;
  /** The page gutter, and the gap between the two columns. */
  gutter: number;
  /** Service cards to a row in the price grid. */
  priceColumns: number;
  /** The hero's floor height. It grows with the window it crowns. */
  heroHeight: number;
  /**
   * True once there is room to stand supporting material — the shop's
   * details, the total and its buttons — beside the main column rather than
   * under it or in a bar across the foot of the window.
   */
  hasAside: boolean;
  /** How wide that second column is drawn. Zero when there is not one. */
  asideWidth: number;
}

const LAYOUTS: Readonly<Record<Breakpoint, Omit<WebLayout, 'breakpoint' | 'contentWidth'>>> = {
  phone: { gutter: 16, priceColumns: 2, heroHeight: 300, hasAside: false, asideWidth: 0 },
  tablet: { gutter: 24, priceColumns: 3, heroHeight: 340, hasAside: false, asideWidth: 0 },
  laptop: { gutter: 28, priceColumns: 3, heroHeight: 380, hasAside: true, asideWidth: 320 },
  desktop: { gutter: 32, priceColumns: 4, heroHeight: 420, hasAside: true, asideWidth: 360 },
};

/** Where the content stops growing, per size. A phone is handed its viewport. */
const CONTENT_WIDTHS: Readonly<Record<Exclude<Breakpoint, 'phone'>, number>> = {
  tablet: 760,
  laptop: 1120,
  desktop: 1320,
};

export function breakpointFor(viewportWidth: number): Breakpoint {
  // A width that has not been measured yet arrives as 0 or NaN. The phone
  // layout is the safe first paint: it fits every window, wide ones included.
  if (!(viewportWidth > 0)) return 'phone';
  if (viewportWidth >= BREAKPOINTS.desktop) return 'desktop';
  if (viewportWidth >= BREAKPOINTS.laptop) return 'laptop';
  if (viewportWidth >= BREAKPOINTS.tablet) return 'tablet';
  return 'phone';
}

export function webLayout(viewportWidth: number): WebLayout {
  const breakpoint = breakpointFor(viewportWidth);
  // Clamped to the window as well as to the size: a 700px viewport is a
  // tablet, but it is still only 700px wide.
  const room = Math.max(viewportWidth, 0);
  const contentWidth = breakpoint === 'phone' ? room : Math.min(room, CONTENT_WIDTHS[breakpoint]);
  return { breakpoint, contentWidth, ...LAYOUTS[breakpoint] };
}

/**
 * The main column's width once the aside has taken its share.
 *
 * Wanted by anything that has to decide how many things fit across the part of
 * the page it actually owns.
 */
export function mainWidth(layout: WebLayout): number {
  if (!layout.hasAside) return layout.contentWidth;
  return layout.contentWidth - layout.asideWidth - layout.gutter;
}

/**
 * Items dealt into rows of `columns`, the last row padded with blanks.
 *
 * A grid built from wrapping runs its last row short and stretches the one
 * card in it across the page. Padding the row keeps every card the width of
 * its neighbours, whatever the count.
 */
export function gridRows<T>(items: readonly T[], columns: number): (T | null)[][] {
  const width = Math.max(1, Math.floor(columns));
  const rows: (T | null)[][] = [];
  for (let index = 0; index < items.length; index += width) {
    const row: (T | null)[] = [];
    for (let column = 0; column < width; column += 1) {
      row.push(items[index + column] ?? null);
    }
    rows.push(row);
  }
  return rows;
}
