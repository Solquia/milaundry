/**
 * How a page answers the box it is drawn in.
 *
 * The box is a phone: `web-frame.ts` hands every web page a phone-width
 * column, because a phone is what a customer opens a shop's link on. So the
 * sizes that matter most here are the ones phones actually differ by — a 320px
 * handset and a 430px one are not the same page, and neither is one turned
 * sideways.
 *
 * Five sizes, each earning its own answer rather than interpolating: a small
 * phone, an ordinary one, a tablet or a split window, a laptop, and a large
 * desktop. The steps are where a layout actually breaks, not round numbers:
 * below 380 a 16px gutter either side is a noticeable bite out of a price card,
 * below 700 there is only room for one column of controls, above 1024 there is
 * room for a second column of supporting material beside the main one, and past
 * 1440 a single column of text would be too long a line to read comfortably.
 *
 * The three wide sizes are unreachable while the frame caps the column at a
 * phone. They are kept, tested and true, because the cap is one constant: the
 * day a shop wants a desktop storefront, the shapes are already here.
 */

export type Breakpoint = 'compact' | 'phone' | 'tablet' | 'laptop' | 'desktop';

/** The narrowest viewport that counts as each size. `compact` is everything below. */
export const BREAKPOINTS = { phone: 380, tablet: 700, laptop: 1024, desktop: 1440 } as const;

/**
 * The tallest a hero may stand as a share of the window it crowns, and the
 * shortest it may be squeezed to.
 *
 * A 300px hero is a third of a phone held upright and the whole of one held
 * sideways — a customer turning their phone to read a price list would have
 * met a photo and nothing else. The floor stops the clamp from collapsing the
 * block on a very short window; the hero's own content can still push past it,
 * since this is a minimum height rather than a fixed one.
 */
const HERO_SHARE_OF_WINDOW = 0.42;
const HERO_MIN_HEIGHT = 140;
/**
 * What the hero's contents occupy at full size — logo, name, tagline, chips and
 * the padding around them. Below this the block can no longer be drawn as it
 * wants to be, and the crown has to give something up rather than simply stand
 * shorter. A small phone held upright lands above it; the same phone turned
 * sideways lands well under.
 */
const HERO_CONTENT_HEIGHT = 230;

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
   * How deep the arc across the foot of the hero cuts.
   *
   * The block used to end in a 28px corner nub, which at a glance is just a
   * rounded rectangle. This is a drawn curve: the bottom edge leaves the side
   * walls this far up and sweeps to its lowest point at the centre. The words
   * are padded clear of it, so the depth is also the room the foot gives up.
   */
  heroSweep: number;
  /**
   * True once there is room to stand supporting material — the shop's
   * details, the total and its buttons — beside the main column rather than
   * under it or in a bar across the foot of the window.
   */
  hasAside: boolean;
  /** How wide that second column is drawn. Zero when there is not one. */
  asideWidth: number;
  /**
   * True when the window is too short to give the hero the height its width
   * asked for — a phone turned sideways, a browser squashed against a taskbar.
   * A floor height alone cannot answer that: the hero's own contents hold it
   * open past any minimum, so the crown has to spend less on itself.
   */
  isTight: boolean;
}

/** What each size asks for. `contentWidth` and `isTight` are worked out per window. */
const LAYOUTS: Readonly<
  Record<Breakpoint, Omit<WebLayout, 'breakpoint' | 'contentWidth' | 'isTight'>>
> = {
  compact: { gutter: 12, priceColumns: 2, heroHeight: 260, heroSweep: 40, hasAside: false, asideWidth: 0 },
  phone: { gutter: 16, priceColumns: 2, heroHeight: 300, heroSweep: 52, hasAside: false, asideWidth: 0 },
  tablet: { gutter: 24, priceColumns: 3, heroHeight: 340, heroSweep: 60, hasAside: false, asideWidth: 0 },
  laptop: { gutter: 28, priceColumns: 3, heroHeight: 380, heroSweep: 68, hasAside: true, asideWidth: 320 },
  desktop: { gutter: 32, priceColumns: 4, heroHeight: 420, heroSweep: 76, hasAside: true, asideWidth: 360 },
};

/** Where the content stops growing, per size. A phone is handed its viewport. */
const CONTENT_WIDTHS: Readonly<Record<Exclude<Breakpoint, 'compact' | 'phone'>, number>> = {
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
  if (viewportWidth >= BREAKPOINTS.phone) return 'phone';
  return 'compact';
}

export function webLayout(viewportWidth: number, viewportHeight?: number): WebLayout {
  const breakpoint = breakpointFor(viewportWidth);
  // Clamped to the window as well as to the size: a 700px viewport is a
  // tablet, but it is still only 700px wide.
  const room = Math.max(viewportWidth, 0);
  const fills = breakpoint === 'compact' || breakpoint === 'phone';
  const contentWidth = fills ? room : Math.min(room, CONTENT_WIDTHS[breakpoint]);
  const size = LAYOUTS[breakpoint];
  const heroHeight = heroHeightIn(size.heroHeight, viewportHeight);
  return {
    breakpoint,
    contentWidth,
    ...size,
    heroHeight,
    // The arc is a share of the block it ends, so a hero the window has cut
    // short does not keep a curve sized for the tall one.
    heroSweep: Math.max(32, Math.min(size.heroSweep, Math.round(heroHeight * 0.22))),
    isTight: heroHeight < HERO_CONTENT_HEIGHT,
  };
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

/**
 * The hero's height once the window's own height has had its say.
 *
 * The width tells you how grand the block wants to be; the height tells you
 * how much room there is to be grand in. A phone turned sideways is 360px
 * tall, and a hero sized for a portrait screen would have filled it, so the
 * page opened on a photo with the prices somewhere below the fold. An
 * unmeasured height — before the first layout pass, or on a caller that never
 * had one — leaves the width's answer alone.
 */
function heroHeightIn(wanted: number, viewportHeight?: number): number {
  if (!(typeof viewportHeight === 'number' && viewportHeight > 0)) return wanted;
  const room = Math.round(viewportHeight * HERO_SHARE_OF_WINDOW);
  return Math.max(HERO_MIN_HEIGHT, Math.min(wanted, room));
}
